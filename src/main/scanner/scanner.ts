import {
  titleFromPath,
  type MediaFileInput,
  type ScanProgress,
  type Source,
} from '@shared/library';
import type { Library } from '../db';
import { inspectMedia, isPlayable } from '../mediaInspect';
import type { Thumbnails } from './thumbnails';
import { walk, type FoundFile } from './walk';

export interface ScannerOptions {
  thumbnails?: Thumbnails;
  onProgress?: (p: ScanProgress) => void;
  /** Injection pour les tests. */
  inspect?: typeof inspectMedia;
  walker?: typeof walk;
}

/**
 * Indexe une source : parcours, inspection des fichiers nouveaux ou modifiés (taille + date),
 * enregistrement en base, vignettes, puis marquage des fichiers disparus. Tout est asynchrone ;
 * la progression est publiée après chaque fichier.
 */
export async function scanSource(
  lib: Library,
  source: Source,
  opts: ScannerOptions = {},
): Promise<ScanProgress> {
  const inspect = opts.inspect ?? inspectMedia;
  const walker = opts.walker ?? walk;
  const progress: ScanProgress = {
    sourceId: source.id,
    path: source.path,
    scanned: 0,
    indexed: 0,
    skipped: 0,
    rejected: 0,
    removed: 0,
    current: null,
    done: false,
    error: null,
    startedAt: Date.now(),
  };
  const report = () => opts.onProgress?.({ ...progress });
  const present: string[] = [];

  try {
    for await (const found of walker(source.path)) {
      progress.scanned++;
      progress.current = found.path;
      present.push(found.path);
      const existing = lib.files.byPath(found.path);
      // Une entrée incomplète (inspection ratée ou ancienne version) est réinspectée même si le
      // fichier n'a pas changé.
      const complete =
        existing &&
        (found.kind === 'video' ? Boolean(existing.videoCodec) : Boolean(existing.audioCodec));
      const unchanged =
        existing &&
        complete &&
        existing.size === found.size &&
        existing.mtime === found.mtime &&
        existing.missingSince === null;
      if (unchanged) {
        progress.skipped++;
        // Vignette manquante (ex. cache vidé) : on la régénère sans réinspecter.
        if (
          found.kind === 'video' &&
          opts.thumbnails &&
          !opts.thumbnails.isFresh(existing.id, found.mtime)
        ) {
          await opts.thumbnails.generate(existing.id, found.path, existing.duration);
        }
        report();
        continue;
      }
      if (await indexFile(lib, source, found, inspect, opts.thumbnails)) {
        progress.indexed++;
      } else {
        progress.rejected++;
      }
      report();
    }
    progress.removed = lib.files.markMissing(source.id, present);
    if (progress.removed) lib.music.prune();
    lib.sources.touchScanned(source.id);
  } catch (err) {
    progress.error = (err as Error).message;
  }
  progress.current = null;
  progress.done = true;
  report();
  return progress;
}

/**
 * Inspecte et enregistre un fichier (aussi utilisé par le watcher). Retourne faux — et retire
 * une éventuelle entrée précédente — si le fichier n'est pas un média lisible (extension trompeuse).
 */
export async function indexFile(
  lib: Library,
  source: Source | null,
  found: FoundFile,
  inspect: typeof inspectMedia = inspectMedia,
  thumbnails?: Thumbnails,
): Promise<boolean> {
  const info = await inspect(found.path);
  if (!isPlayable(info)) {
    const previous = lib.files.byPath(found.path);
    if (previous) lib.files.remove(previous.id);
    return false;
  }
  const input: MediaFileInput = {
    path: found.path,
    kind: found.kind,
    sourceId: source?.id ?? null,
    size: found.size,
    mtime: found.mtime,
    title: found.kind === 'audio' && info.tags?.title ? info.tags.title : titleFromPath(found.path),
    duration: info.duration ?? null,
    width: info.width ?? null,
    height: info.height ?? null,
    container: info.container ?? null,
    videoCodec: info.videoCodec ?? null,
    audioCodec: info.audioCodec ?? null,
  };
  const file = lib.files.upsert(input);
  if (found.kind === 'audio' && info.tags) {
    lib.music.upsertTrack(file.id, file.title, info.tags);
  }
  if (found.kind === 'video' && thumbnails && !thumbnails.isFresh(file.id, found.mtime)) {
    await thumbnails.generate(file.id, found.path, file.duration);
  }
  return true;
}
