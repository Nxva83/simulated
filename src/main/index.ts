import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { appendFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { IPC } from '@shared/ipc';
import { dialogFilters, isSupported } from '@shared/mediaFormats';
import { registerLibraryIpc } from './libraryIpc';
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
/** EPIKODI_SMOKE_OUT=<fichier> : le rapport y est aussi écrit de façon synchrone (stdout vers un
 * pipe est asynchrone sous Linux/Windows et peut être perdu à la sortie du processus). */
const smokeOut = process.env.EPIKODI_SMOKE_OUT;
/** EPIKODI_SMOKE_SEEK=<s> : après ouverture, demande un seek à cette position avant le rapport. */
const smokeSeek = Number(process.env.EPIKODI_SMOKE_SEEK ?? 0);

let mainWindow: BrowserWindow | null = null;
/** Fichier reçu avant que la fenêtre soit prête (argument CLI, open-file macOS). */
let pendingFile: string | null = null;

registerMediaScheme();

// Une exception non rattrapée dans le processus principal ouvre une boîte de dialogue modale qui
// bloque la boucle d'événements : on la journalise et on continue (en smoke, elle fait échouer la CI).
process.on('uncaughtException', (err) => {
  console.error('[main] exception non rattrapée :', err);
  if (isSmoke) {
    smokeLog(`SMOKE_CONSOLE [main-exception] ${err.message}`);
  }
});

function mediaFileFromArgs(argv: string[]): string | null {
  const candidate = argv.slice(isDev ? 2 : 1).find((a) => !a.startsWith('-') && isSupported(a));
  return candidate ? resolve(candidate) : null;
}

function smokeLog(line: string): void {
  console.log(line);
  if (smokeOut) appendFileSync(smokeOut, line + '\n');
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
  smokeLog(`SMOKE_SEEK ${r}`);
}

async function reportSmokeMedia(): Promise<void> {
  const timeout = new Promise<string>((res) => setTimeout(() => res('timeout'), 5000));
  const r = await Promise.race([
    timeout,
    mainWindow?.webContents.executeJavaScript(`(() => {
    const v = document.querySelector('video');
    if (!v) return 'no-video';
    return 'audio=' + (v.webkitAudioDecodedByteCount ?? 0) +
      ' video=' + (v.getVideoPlaybackQuality?.().totalVideoFrames ?? 0) +
      ' position=' + v.currentTime.toFixed(1) +
      ' shown=' + (document.querySelector('.time')?.textContent ?? '').replace(/\\s/g, '') +
      ' seekable=' + (v.seekable.length ? v.seekable.end(0).toFixed(1) : 'none') +
      ' ready=' + v.readyState + ' net=' + v.networkState + ' paused=' + v.paused +
      ' error=' + (v.error ? v.error.code : 0) +
      ' text="' + (document.querySelector('.stage .text')?.textContent ?? '') + '"';
  })()`) as Promise<string>,
  ]);
  smokeLog(`SMOKE_MEDIA ${r}`);
  setTimeout(() => app.quit(), 200);
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
  if (isSmoke) {
    // En smoke, la console du renderer est relayée : indispensable pour diagnostiquer en CI.
    mainWindow.webContents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 'warning') {
        smokeLog(`SMOKE_CONSOLE [${event.level}] ${event.message}`);
      }
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      smokeLog(`SMOKE_CONSOLE [gone] ${details.reason}`);
    });
  }
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      mainWindow?.webContents.send(IPC.openFile, pendingFile);
      pendingFile = null;
    }
    if (isSmoke) {
      smokeLog('SMOKE_OK');
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
// (Désactivé en smoke : la CI enchaîne des lancements et le verrou précédent peut survivre.)
if (!isSmoke && !app.requestSingleInstanceLock()) {
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
    registerLibraryIpc();
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
