import { MEDIA_SCHEME } from './ipc';

/**
 * URLs servies par le processus principal (voir main/mediaProtocol.ts) :
 *   media://local/<chemin>            fichier brut, requêtes Range (seek natif)
 *   media://transcode/<chemin>?t=<s>[&v=1]
 *                                     flux ffmpeg à partir de t secondes (audio → AAC ; vidéo
 *                                     copiée, ou réencodée en H.264 si v=1), non seekable
 */
export type MediaHost = 'local' | 'transcode';

function encodePath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
}

export interface MediaUrlOptions {
  transcode?: boolean;
  /** Réencoder aussi la vidéo (H.264) ; sans effet si `transcode` est faux. */
  video?: boolean;
  start?: number;
}

export function toMediaUrl(filePath: string, opts?: MediaUrlOptions): string {
  const host: MediaHost = opts?.transcode ? 'transcode' : 'local';
  const url = `${MEDIA_SCHEME}://${host}/${encodePath(filePath)}`;
  if (!opts?.transcode) return url;
  const params = new URLSearchParams();
  if (opts.start) params.set('t', String(opts.start));
  if (opts.video) params.set('v', '1');
  const q = params.toString();
  return q ? `${url}?${q}` : url;
}

export interface ParsedMediaUrl {
  host: MediaHost;
  /** Chemin local (POSIX `/a/b`, Windows `C:/a/b`). */
  filePath: string;
  /** Position de départ en secondes (transcode uniquement). */
  start: number;
  /** Réencodage vidéo demandé (transcode uniquement). */
  video: boolean;
}

export function parseMediaUrl(url: string): ParsedMediaUrl {
  const u = new URL(url);
  const decoded = decodeURIComponent(u.pathname);
  const filePath = /^\/[A-Za-z]:/.test(decoded) ? decoded.slice(1) : decoded;
  const host = u.hostname === 'transcode' ? 'transcode' : 'local';
  const t = Number(u.searchParams.get('t') ?? 0);
  return {
    host,
    filePath,
    start: Number.isFinite(t) && t > 0 ? t : 0,
    video: host === 'transcode' && u.searchParams.get('v') === '1',
  };
}
