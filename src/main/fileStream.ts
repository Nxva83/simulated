import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { extensionOf } from '@shared/mediaFormats';

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mka: 'audio/x-matroska',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/** Interprète `Range: bytes=a-b` ; null si absent ou invalide. */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || size === 0) return null;
  const [, a, b] = m;
  if (a === '' && b === '') return null;
  const start = a === '' ? Math.max(0, size - Number(b)) : Number(a);
  const end = a !== '' && b !== '' ? Math.min(Number(b), size - 1) : size - 1;
  if (start > end || start >= size) return null;
  return { start, end };
}

/**
 * Sert un fichier local à <video>/<audio> avec support des requêtes Range (206 + Content-Range) :
 * sans cela Chromium considère le média comme non seekable.
 */
export async function serveFile(filePath: string, rangeHeader: string | null): Promise<Response> {
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response('Fichier introuvable', { status: 404 });
  }
  const type = MIME[extensionOf(filePath)] ?? 'application/octet-stream';
  const range = parseRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
