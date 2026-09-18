import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { IPC } from '@shared/ipc';
import { dialogFilters, isSupported } from '@shared/mediaFormats';
import { getLibrary, getScanManager, registerLibraryIpc } from './libraryIpc';
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
/** EPIKODI_SMOKE_SOURCE=<dossier> : l'ajoute comme source, attend la fin de l'indexation et
 * rapporte `SMOKE_SCAN indexed=<n> skipped=<n> rejected=<n> files=<n> thumbs=<n>`. */
const smokeSource = process.env.EPIKODI_SMOKE_SOURCE;
/** EPIKODI_SMOKE_UI=1 : parcours clavier accueil → fiche → lecture, puis recherche ; rapporte
 * `SMOKE_UI detail=<titre> playing=<bool> search=<n>`. Suppose une bibliothèque déjà indexée. */
const smokeUi = process.env.EPIKODI_SMOKE_UI === '1';
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

/** Exécute du JS dans la page et attend que le résultat soit vrai (ou expire). */
async function waitFor(js: string, timeoutMs = 8000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = (await mainWindow?.webContents.executeJavaScript(js)) as string | boolean | null;
    if (r) return String(r);
    await new Promise((res) => setTimeout(res, 100));
  }
  return '';
}

/** EPIKODI_SMOKE_SHOTS=<dossier> : capture la fenêtre à chaque étape du parcours. */
async function shot(name: string): Promise<void> {
  const dir = process.env.EPIKODI_SMOKE_SHOTS;
  if (!dir || !mainWindow) return;
  await new Promise((r) => setTimeout(r, 400));
  const img = await mainWindow.webContents.capturePage();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), img.toPNG());
}

/** Parcours utilisateur au clavier : accueil → fiche (Entrée) → lecture → recherche. */
async function smokeUiFlow(): Promise<void> {
  const key = (k: string) =>
    mainWindow?.webContents.executeJavaScript(
      `(() => { const t = document.activeElement || document.body;
         const e = new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true });
         t.dispatchEvent(e); if (${JSON.stringify(k)} === 'Enter' && !e.defaultPrevented) t.click(); return true; })()`,
    );
  await waitFor(`!!document.querySelector('.home .card')`);
  await mainWindow?.webContents.executeJavaScript(
    `document.querySelector('.home .card').focus(); true`,
  );
  await key('ArrowRight'); // navigation spatiale : carte suivante
  await shot('1-accueil');
  await key('Enter'); // ouvre la fiche
  const detail = await waitFor(`document.querySelector('.detail h1')?.textContent || ''`);
  await waitFor(`!!document.querySelector('.detail .actions .btn.primary')`);
  await shot('2-fiche');
  await mainWindow?.webContents.executeJavaScript(
    `document.querySelector('.detail .actions .btn.primary').click(); true`,
  );
  const playing = await waitFor(
    `(() => { const v = document.querySelector('video'); return v && !v.paused && v.currentTime > 0.5; })()`,
  );
  await shot('3-lecture');
  await key('Escape'); // retour à la fiche
  await waitFor(`!!document.querySelector('.detail')`);
  await key('/'); // recherche
  await waitFor(`!!document.querySelector('.search-input')`);
  await mainWindow?.webContents.executeJavaScript(`(() => {
    const i = document.querySelector('.search-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(process.env.EPIKODI_SMOKE_QUERY ?? 'pattern')});
    i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const results = await waitFor(`document.querySelectorAll('.search .card').length || ''`);
  await shot('4-recherche');
  // Bibliothèque Films en mode TV.
  await mainWindow?.webContents.executeJavaScript(
    `(() => { [...document.querySelectorAll('.nav-item')].find((b) => b.textContent.includes('Films')).click(); return true; })()`,
  );
  await waitFor(`!!document.querySelector('.library .card')`);
  await mainWindow?.webContents.executeJavaScript(
    `document.documentElement.classList.add('tv'); document.querySelector('.library .card').focus(); true`,
  );
  await shot('5-films-mode-tv');
  smokeLog(`SMOKE_UI detail="${detail}" playing=${playing === 'true'} search=${results || 0}`);
  setTimeout(() => app.quit(), 200);
}

/** Indexe un dossier et rapporte le résultat (CI). */
async function smokeScan(dir: string): Promise<void> {
  const manager = getScanManager();
  const source = manager.addSource(dir, 'mixed');
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const p = manager.snapshot().find((x) => x.sourceId === source.id);
    if (p?.done) {
      const files = getLibrary().files.count();
      const thumbs = getLibrary()
        .files.list({ kind: 'video', limit: 1000 })
        .filter((f) => manager.thumbnails.has(f.id)).length;
      smokeLog(
        `SMOKE_SCAN indexed=${p.indexed} skipped=${p.skipped} rejected=${p.rejected} files=${files} thumbs=${thumbs} error=${p.error ?? 'none'}`,
      );
      setTimeout(() => app.quit(), 200);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  smokeLog('SMOKE_SCAN timeout');
  app.quit();
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
      if (smokeSource) {
        void smokeScan(resolve(smokeSource));
      } else if (smokeUi) {
        void smokeUiFlow();
      } else if (smokeFile) {
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
