import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpegPath } from '../transcoder';

/**
 * Vignettes des vidéos : une image JPEG par fichier, prise à 10 % de la durée (ou 10 s),
 * stockée dans `<dir>/<id>.jpg`. Le cache est invalidé quand le fichier source est plus récent
 * que la vignette.
 */
export class Thumbnails {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  pathFor(id: number): string {
    return join(this.dir, `${id}.jpg`);
  }

  has(id: number): boolean {
    return existsSync(this.pathFor(id));
  }

  /** Vrai si une vignette existe et n'est pas plus ancienne que le média. */
  isFresh(id: number, mediaMtimeSeconds: number | null): boolean {
    try {
      return statSync(this.pathFor(id)).mtimeMs / 1000 >= (mediaMtimeSeconds ?? 0);
    } catch {
      return false;
    }
  }

  /**
   * Génère la vignette ; résout à false si ffmpeg échoue (fichier corrompu, audio seul…).
   * Position : 10 % de la durée (plafonné à 10 min), la moitié pour les clips courts, puis
   * nouvelle tentative au début si la première image est introuvable.
   */
  async generate(id: number, mediaPath: string, durationSeconds: number | null): Promise<boolean> {
    const at =
      durationSeconds && durationSeconds < 20
        ? durationSeconds / 2
        : durationSeconds
          ? Math.min(durationSeconds * 0.1, 600)
          : 10;
    return (
      (await this.capture(id, mediaPath, at)) || (at > 0 && (await this.capture(id, mediaPath, 0)))
    );
  }

  private capture(id: number, mediaPath: string, at: number): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(
        ffmpegPath(),
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-ss',
          at.toFixed(2),
          '-i',
          mediaPath,
          '-frames:v',
          '1',
          '-vf',
          'scale=480:-2',
          '-q:v',
          '4',
          this.pathFor(id),
        ],
        { timeout: 20000, windowsHide: true },
        (err) => resolve(!err && this.has(id)),
      );
    });
  }
}
