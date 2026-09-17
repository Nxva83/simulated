import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type EpikodiApi } from '@shared/ipc';
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
};

contextBridge.exposeInMainWorld('epikodi', api);
