import { spawn, type ChildProcess } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

/** Chemin du binaire ffmpeg embarqué (hors de l'archive asar une fois packagé). */
export function ffmpegPath(): string {
  const p = (ffmpegStatic as unknown as string | null) ?? 'ffmpeg';
  return p.replace('app.asar', 'app.asar.unpacked');
}

/**
 * Arguments ffmpeg pour rendre lisible par Chromium un fichier dont la piste audio n'est pas
 * décodée (AC3/E-AC3/DTS…) : vidéo copiée telle quelle (aucun réencodage, CPU bas), audio
 * converti en AAC stéréo, conteneur Matroska en mode « live » écrit sur stdout.
 */
export function transcodeArgs(filePath: string, startSeconds: number): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    ...(startSeconds > 0 ? ['-ss', startSeconds.toFixed(3)] : []),
    '-i',
    filePath,
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0',
    '-sn',
    '-dn',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ac',
    '2',
    '-f',
    'matroska',
    '-live',
    '1',
    '-cluster_time_limit',
    '1000',
    'pipe:1',
  ];
}

/**
 * Lance ffmpeg et expose sa sortie comme un ReadableStream pour `Response`.
 * Le processus est tué dès que le consommateur annule le flux (changement de fichier, seek,
 * fermeture) ou à l'appel de `killAll()`.
 */
export class Transcoder {
  private readonly children = new Set<ChildProcess>();

  constructor() {
    // Quoi qu'il arrive au processus principal (quit, signal, crash), aucun ffmpeg ne survit.
    const cleanup = () => this.killAll();
    process.once('exit', cleanup);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      process.once(sig, () => {
        cleanup();
        process.exit(0);
      });
    }
  }

  /**
   * Démarre un nouveau flux. Un seul flux à la fois : une nouvelle demande (seek, autre
   * fichier) tue la précédente, Chromium ayant parfois déjà abandonné sans annuler.
   */
  stream(filePath: string, startSeconds: number): ReadableStream<Uint8Array> {
    this.killAll();
    const child = spawn(ffmpegPath(), transcodeArgs(filePath, startSeconds), {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.children.add(child);
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('exit', (code) => {
      this.children.delete(child);
      if (code && code !== 0 && !child.killed) {
        console.error(`[transcode] ffmpeg a quitté avec le code ${code}: ${stderr.trim()}`);
      }
    });

    const stdout = child.stdout!;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        // Binaire absent ou non exécutable : on ferme le flux en erreur plutôt que de bloquer.
        child.on('error', (err) => {
          console.error(
            `[transcode] impossible de lancer ffmpeg (${ffmpegPath()}): ${err.message}`,
          );
          try {
            controller.error(err);
          } catch {
            /* déjà fermé */
          }
        });
        stdout.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        stdout.on('end', () => {
          try {
            controller.close();
          } catch {
            /* déjà fermé */
          }
        });
        stdout.on('error', (err) => controller.error(err));
      },
      cancel() {
        child.kill('SIGKILL');
      },
    });
  }

  killAll(): void {
    for (const child of this.children) child.kill('SIGKILL');
    this.children.clear();
  }
}
