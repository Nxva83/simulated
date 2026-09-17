const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

ipcMain.handle('list-dir', async (_evt, p) => {
  const dir = p || os.homedir();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
});
ipcMain.on('ready', () => {
  console.log(`READY ${Date.now()}`);
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1024, height: 640, title: 'EPIKODI bench (Electron)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'common', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
