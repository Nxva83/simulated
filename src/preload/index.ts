import { contextBridge, ipcRenderer } from 'electron';
import { IPC, MEDIA_SCHEME, type EpikodiApi } from '@shared/ipc';

function toMediaUrl(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter(Boolean).map(encodeURIComponent);
  return `${MEDIA_SCHEME}://local/${segments.join('/')}`;
}

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
