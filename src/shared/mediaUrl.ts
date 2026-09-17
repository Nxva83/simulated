import { MEDIA_SCHEME } from './ipc';

/**
 * URLs servies par le processus principal (voir main/mediaProtocol.ts) :
 *   media://local/<chemin>            fichier brut, requêtes Range (seek natif)
 *   media://transcode/<chemin>?t=<s>  flux remuxé par ffmpeg à partir de t secondes
 *                                     (vidéo copiée, audio → AAC), non seekable
 */
export type MediaHost = 'local' | 'transcode';

function encodePath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
}

export function toMediaUrl(
  filePath: string,
  opts?: { transcode?: boolean; start?: number },
): string {
  const host: MediaHost = opts?.transcode ? 'transcode' : 'local';
  const url = `${MEDIA_SCHEME}://${host}/${encodePath(filePath)}`;
  return opts?.transcode && opts.start ? `${url}?t=${opts.start}` : url;
}

export interface ParsedMediaUrl {
  host: MediaHost;
  /** Chemin local (POSIX `/a/b`, Windows `C:/a/b`). */
  filePath: string;
  /** Position de départ en secondes (transcode uniquement). */
  start: number;
}

export function parseMediaUrl(url: string): ParsedMediaUrl {
  const u = new URL(url);
  const decoded = decodeURIComponent(u.pathname);
  const filePath = /^\/[A-Za-z]:/.test(decoded) ? decoded.slice(1) : decoded;
  const host = u.hostname === 'transcode' ? 'transcode' : 'local';
  const t = Number(u.searchParams.get('t') ?? 0);
  return { host, filePath, start: Number.isFinite(t) && t > 0 ? t : 0 };
}
