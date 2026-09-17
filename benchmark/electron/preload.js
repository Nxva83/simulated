const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bridge', {
  name: 'Electron',
  listDir: (p) => ipcRenderer.invoke('list-dir', p),
  ready: () => ipcRenderer.send('ready'),
});
