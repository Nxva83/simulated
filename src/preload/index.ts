import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type EpikodiApi, type LibraryChange } from '@shared/ipc';
import type { ScanProgress } from '@shared/library';
import { toMediaUrl } from '@shared/mediaUrl';

const api: EpikodiApi = {
  openFileDialog: () => ipcRenderer.invoke(IPC.openFileDialog),
  fileExists: (path) => ipcRenderer.invoke(IPC.fileExists, path),
  inspectMedia: (path) => ipcRenderer.invoke(IPC.inspectMedia, path),
  toMediaUrl,
  onOpenFile: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, path: string) => cb(path);
    ipcRenderer.on(IPC.openFile, listener);
    return () => ipcRenderer.removeListener(IPC.openFile, listener);
  },
  platform: process.platform,

  library: {
    registerFile: (path) => ipcRenderer.invoke(IPC.libraryRegisterFile, path),
    list: (opts) => ipcRenderer.invoke(IPC.libraryList, opts ?? {}),
    search: (q, limit) => ipcRenderer.invoke(IPC.librarySearch, q, limit),
    file: (id) => ipcRenderer.invoke(IPC.libraryFile, id),
    searchItems: (q, limit) => ipcRenderer.invoke(IPC.librarySearchItems, q, limit),
    home: () => ipcRenderer.invoke(IPC.libraryHome),
    detail: (id) => ipcRenderer.invoke(IPC.libraryDetail, id),
  },
  playback: {
    get: (ref) => ipcRenderer.invoke(IPC.playbackGet, ref),
    resumePosition: (ref) => ipcRenderer.invoke(IPC.playbackResume, ref),
    started: (ref, duration) => ipcRenderer.invoke(IPC.playbackStarted, ref, duration),
    progress: (ref, position, duration) =>
      ipcRenderer.invoke(IPC.playbackProgress, ref, position, duration),
    setWatched: (ref, watched) => ipcRenderer.invoke(IPC.playbackSetWatched, ref, watched),
    setFavorite: (ref, favorite) => ipcRenderer.invoke(IPC.playbackSetFavorite, ref, favorite),
    setRating: (ref, rating) => ipcRenderer.invoke(IPC.playbackSetRating, ref, rating),
    inProgress: (limit) => ipcRenderer.invoke(IPC.playbackInProgress, limit),
    recent: (limit) => ipcRenderer.invoke(IPC.playbackRecent, limit),
  },
  settings: {
    get: (key, fallback) => ipcRenderer.invoke(IPC.settingsGet, key, fallback),
    set: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  },
  sources: {
    list: () => ipcRenderer.invoke(IPC.sourcesList),
    pickFolder: () => ipcRenderer.invoke(IPC.sourcesPickFolder),
    add: (path, kind) => ipcRenderer.invoke(IPC.sourcesAdd, path, kind),
    remove: (id) => ipcRenderer.invoke(IPC.sourcesRemove, id),
  },
  scan: {
    start: (sourceId) => ipcRenderer.invoke(IPC.scanStart, sourceId),
    status: () => ipcRenderer.invoke(IPC.scanStatus),
    onProgress: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, p: ScanProgress) => cb(p);
      ipcRenderer.on(IPC.scanProgress, listener);
      return () => ipcRenderer.removeListener(IPC.scanProgress, listener);
    },
  },
  onLibraryChanged: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, c: LibraryChange) => cb(c);
    ipcRenderer.on(IPC.libraryChanged, listener);
    return () => ipcRenderer.removeListener(IPC.libraryChanged, listener);
  },
  db: {
    backup: () => ipcRenderer.invoke(IPC.dbBackup),
    restore: () => ipcRenderer.invoke(IPC.dbRestore),
  },
};

contextBridge.exposeInMainWorld('epikodi', api);
