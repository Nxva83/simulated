import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { IPC } from '@shared/ipc';
import { dialogFilters, isSupported } from '@shared/mediaFormats';
import { inspectMedia } from './mediaInspect';
import { installMediaProtocol, registerMediaScheme } from './mediaProtocol';

const isDev = !!process.env.ELECTRON_RENDERER_URL;
/** EPIKODI_SMOKE=1 : ouvre la fenêtre, attend le rendu, quitte. Utilisé par la CI. */
const isSmoke = process.env.EPIKODI_SMOKE === '1';

let mainWindow: BrowserWindow | null = null;
/** Fichier reçu avant que la fenêtre soit prête (argument CLI, open-file macOS). */
let pendingFile: string | null = null;

registerMediaScheme();

function mediaFileFromArgs(argv: string[]): string | null {
  const candidate = argv.slice(isDev ? 2 : 1).find((a) => !a.startsWith('-') && isSupported(a));
  return candidate ? resolve(candidate) : null;
}

function sendOpenFile(path: string): void {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(IPC.openFile, path);
  } else {
    pendingFile = path;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'EPIKODI',
    backgroundColor: '#101014',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      mainWindow?.webContents.send(IPC.openFile, pendingFile);
      pendingFile = null;
    }
    if (isSmoke) {
      console.log('SMOKE_OK');
      setTimeout(() => app.quit(), 500);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// IPC
ipcMain.handle(IPC.openFileDialog, async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Ouvrir un média',
    properties: ['openFile'],
    filters: dialogFilters(),
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle(IPC.inspectMedia, (_e, path: string) => inspectMedia(path));
ipcMain.handle(IPC.fileExists, async (_e, path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
});

// Une seule instance : un second lancement transmet son fichier à la première.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const file = mediaFileFromArgs(argv);
    if (file) sendOpenFile(file);
    mainWindow?.focus();
  });
  app.on('open-file', (e, path) => {
    e.preventDefault();
    sendOpenFile(path);
  });

  void app.whenReady().then(() => {
    installMediaProtocol();
    pendingFile = mediaFileFromArgs(process.argv);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
