import { app, dialog, ipcMain } from 'electron';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { IPC } from '@shared/ipc';
import { isAudio, isSupported } from '@shared/mediaFormats';
import type { ListOptions, MediaFileInput, PlayableRef, SourceKind } from '@shared/library';
import { Library } from './db';
import { inspectMedia } from './mediaInspect';
import { ScanManager } from './scanner';

let library: Library | null = null;
let scanManager: ScanManager | null = null;

export function thumbnailsDir(): string {
  return process.env.EPIKODI_THUMBS_DIR ?? join(app.getPath('userData'), 'thumbs');
}

export function getScanManager(): ScanManager {
  if (!scanManager) scanManager = new ScanManager(getLibrary(), thumbnailsDir());
  return scanManager;
}

/** Chemin de la base : `<userData>/epikodi.db` (EPIKODI_DB_PATH pour le remplacer, ex. en smoke). */
export function databasePath(): string {
  return process.env.EPIKODI_DB_PATH ?? join(app.getPath('userData'), 'epikodi.db');
}

export function getLibrary(): Library {
  if (!library) library = Library.open(databasePath());
  return library;
}

export async function closeLibrary(): Promise<void> {
  await scanManager?.stop();
  scanManager = null;
  library?.close();
  library = null;
}

/** Ajoute l'URL de vignette aux fichiers qui en ont une. */
function withThumbnails<T extends { id: number; kind: string }>(files: T[]): T[] {
  const thumbs = getScanManager().thumbnails;
  return files.map((f) => ({
    ...f,
    thumbnailUrl: f.kind === 'video' && thumbs.has(f.id) ? `media://thumb/${f.id}.jpg` : null,
  }));
}

/** Enregistre (ou rafraîchit) un fichier ouvert dans le lecteur, avec ses codecs et sa taille. */
async function registerFile(path: string) {
  if (!isSupported(path)) throw new Error(`Format non pris en charge : ${path}`);
  const info = await inspectMedia(path);
  let size: number | null = null;
  let mtime: number | null = null;
  try {
    const st = statSync(path);
    size = st.size;
    mtime = Math.floor(st.mtimeMs / 1000);
  } catch {
    /* fichier réseau ou disparu : on l'enregistre quand même */
  }
  const input: MediaFileInput = {
    path,
    kind: isAudio(path) ? 'audio' : 'video',
    size,
    mtime,
    duration: info.duration ?? null,
    container: info.container ?? null,
    videoCodec: info.videoCodec ?? null,
    audioCodec: info.audioCodec ?? null,
  };
  return getLibrary().files.upsert(input);
}

const trace = process.env.EPIKODI_TRACE === '1';

export function registerLibraryIpc(): void {
  const lib = () => getLibrary();
  if (trace) {
    const original = ipcMain.handle.bind(ipcMain);
    ipcMain.handle = (channel, listener) =>
      original(channel, async (event, ...args) => {
        console.log(`[ipc] > ${channel}`);
        try {
          return await listener(event, ...args);
        } finally {
          console.log(`[ipc] < ${channel}`);
        }
      });
  }

  ipcMain.handle(IPC.libraryRegisterFile, (_e, path: string) => registerFile(path));
  ipcMain.handle(IPC.libraryList, (_e, opts: ListOptions) =>
    withThumbnails(lib().files.list(opts)),
  );
  ipcMain.handle(IPC.librarySearch, (_e, q: string, limit?: number) =>
    lib().files.search(q, limit),
  );
  ipcMain.handle(IPC.libraryFile, (_e, id: number) => {
    const f = lib().files.byId(id);
    return f ? withThumbnails([f])[0] : null;
  });

  ipcMain.handle(IPC.playbackGet, (_e, ref: PlayableRef) => lib().playback.get(ref));
  ipcMain.handle(IPC.playbackResume, (_e, ref: PlayableRef) => lib().playback.resumePosition(ref));
  ipcMain.handle(IPC.playbackStarted, (_e, ref: PlayableRef, duration: number | null) =>
    lib().playback.started(ref, duration),
  );
  ipcMain.handle(
    IPC.playbackProgress,
    (_e, ref: PlayableRef, position: number, duration: number | null) =>
      lib().playback.progress(ref, position, duration),
  );
  ipcMain.handle(IPC.playbackSetWatched, (_e, ref: PlayableRef, watched: boolean) =>
    lib().playback.setWatched(ref, watched),
  );
  ipcMain.handle(IPC.playbackSetFavorite, (_e, ref: PlayableRef, favorite: boolean) =>
    lib().playback.setFavorite(ref, favorite),
  );
  ipcMain.handle(IPC.playbackSetRating, (_e, ref: PlayableRef, rating: number | null) =>
    lib().playback.setRating(ref, rating),
  );
  ipcMain.handle(IPC.playbackInProgress, (_e, limit?: number) => lib().playback.inProgress(limit));
  ipcMain.handle(IPC.playbackRecent, (_e, limit?: number) => lib().playback.recent(limit));

  ipcMain.handle(IPC.settingsGet, (_e, key: string, fallback: unknown) =>
    lib().settings.get(key, fallback),
  );
  ipcMain.handle(IPC.settingsSet, (_e, key: string, value: unknown) =>
    lib().settings.set(key, value),
  );

  ipcMain.handle(IPC.sourcesList, () => lib().sources.list());
  ipcMain.handle(IPC.sourcesAdd, (_e, path: string, kind: SourceKind) =>
    lib().sources.add(path, kind),
  );
  ipcMain.handle(IPC.sourcesRemove, (_e, id: number) => lib().sources.remove(id));

  ipcMain.handle(IPC.dbBackup, async () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const r = await dialog.showSaveDialog({
      title: 'Sauvegarder la bibliothèque',
      defaultPath: join(app.getPath('documents'), `epikodi-${stamp}.db`),
      filters: [{ name: 'Base EPIKODI', extensions: ['db'] }],
    });
    if (r.canceled || !r.filePath) return null;
    lib().backup(r.filePath);
    return r.filePath;
  });
  ipcMain.handle(IPC.dbRestore, async () => {
    const r = await dialog.showOpenDialog({
      title: 'Restaurer une sauvegarde',
      properties: ['openFile'],
      filters: [{ name: 'Base EPIKODI', extensions: ['db'] }],
    });
    if (r.canceled || r.filePaths.length === 0) return false;
    lib().restore(r.filePaths[0]);
    return true;
  });

  app.on('will-quit', () => void closeLibrary());
  // Surveillance et rattrapage des sources dès le démarrage.
  getScanManager().start();
}
