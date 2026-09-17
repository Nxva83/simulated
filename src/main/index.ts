import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { IPC } from '@shared/ipc';
import { dialogFilters, isSupported } from '@shared/mediaFormats';
import { inspectMedia } from './mediaInspect';
import { installMediaProtocol, registerMediaScheme } from './mediaProtocol';

const isDev = !!process.env.ELECTRON_RENDERER_URL;
/**
 * EPIKODI_SMOKE=1 : ouvre la fenêtre, attend le rendu, quitte. Utilisé par la CI.
 * EPIKODI_SMOKE_FILE=<média> : ouvre en plus ce fichier dans le lecteur et rapporte, après
 * quelques secondes, les octets audio et les images vidéo réellement décodés
 * (`SMOKE_MEDIA audio=<octets> video=<images> position=<s>`).
 */
const isSmoke = process.env.EPIKODI_SMOKE === '1';
const smokeFile = process.env.EPIKODI_SMOKE_FILE;
/** EPIKODI_SMOKE_SEEK=<s> : après ouverture, demande un seek à cette position avant le rapport. */
const smokeSeek = Number(process.env.EPIKODI_SMOKE_SEEK ?? 0);

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

/** Simule un glisser-relâcher de la barre de progression jusqu'à `seconds`. */
async function smokeSeekTo(seconds: number): Promise<void> {
  const r = (await mainWindow?.webContents.executeJavaScript(`(() => {
    const seek = document.querySelector('input.seek');
    if (!seek) return 'no-seekbar';
    if (seek.disabled) return 'seekbar-disabled';
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(seek, ${seconds});
    seek.dispatchEvent(new Event('input', { bubbles: true }));
    return new Promise((res) => setTimeout(() => {
      seek.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      res('value=' + seek.value);
    }, 50));
  })()`)) as string;
  console.log(`SMOKE_SEEK ${r}`);
}

async function reportSmokeMedia(): Promise<void> {
  const r = (await mainWindow?.webContents.executeJavaScript(`(() => {
    const v = document.querySelector('video');
    if (!v) return 'no-video';
    return 'audio=' + (v.webkitAudioDecodedByteCount ?? 0) +
      ' video=' + (v.getVideoPlaybackQuality?.().totalVideoFrames ?? 0) +
      ' position=' + v.currentTime.toFixed(1) +
      ' shown=' + (document.querySelector('.time')?.textContent ?? '').replace(/\\s/g, '') +
      ' seekable=' + (v.seekable.length ? v.seekable.end(0).toFixed(1) : 'none') +
      ' error=' + (v.error ? v.error.code : 0);
  })()`)) as string;
  console.log(`SMOKE_MEDIA ${r}`);
  app.quit();
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
      if (smokeFile) {
        mainWindow?.webContents.send(IPC.openFile, resolve(smokeFile));
        if (smokeSeek > 0) {
          setTimeout(() => void smokeSeekTo(smokeSeek), 2500);
        }
        setTimeout(() => void reportSmokeMedia(), smokeSeek > 0 ? 6000 : 4000);
      } else {
        setTimeout(() => app.quit(), 500);
      }
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
