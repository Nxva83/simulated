import { opendir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { extensionOf, isSupported } from '@shared/mediaFormats';

export interface FoundFile {
  path: string;
  size: number;
  /** Secondes depuis l'epoch. */
  mtime: number;
  kind: 'video' | 'audio';
}

/** Dossiers ignorés : cachés, corbeilles, caches système. */
const SKIP_DIRS =
  /^(\.|@eaDir$|#recycle$|\$RECYCLE\.BIN$|System Volume Information$|lost\+found$|node_modules$)/i;

/**
 * Un fichier est retenu si son extension est connue, ou, à défaut d'extension reconnue, si ses
 * premiers octets révèlent un type MIME audio/vidéo (fichiers renommés, sans extension…).
 */
export async function classify(path: string): Promise<'video' | 'audio' | null> {
  if (isSupported(path)) {
    const ext = extensionOf(path);
    return AUDIO_EXTS.has(ext) ? 'audio' : 'video';
  }
  try {
    const ft = await fileTypeFromFile(path);
    if (ft?.mime.startsWith('video/')) return 'video';
    if (ft?.mime.startsWith('audio/')) return 'audio';
  } catch {
    /* illisible : ignoré */
  }
  return null;
}

const AUDIO_EXTS = new Set([
  'mp3',
  'flac',
  'aac',
  'm4a',
  'mka',
  'ogg',
  'oga',
  'opus',
  'wav',
  'wma',
  'aiff',
]);

/**
 * Parcours récursif asynchrone d'un dossier, sans jamais bloquer la boucle d'événements :
 * chaque entrée est traitée entre deux tours. Les liens symboliques ne sont pas suivis
 * (boucles), les dossiers cachés/système sont ignorés.
 */
export async function* walk(root: string): AsyncGenerator<FoundFile> {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let handle;
    try {
      handle = await opendir(dir);
    } catch {
      continue; // permission refusée, dossier disparu
    }
    for await (const entry of handle) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.test(entry.name)) stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const kind = await classify(full);
      if (!kind) continue;
      try {
        const st = await stat(full);
        yield { path: full, size: st.size, mtime: Math.floor(st.mtimeMs / 1000), kind };
      } catch {
        /* disparu entre-temps */
      }
    }
  }
}
