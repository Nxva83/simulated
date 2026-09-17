import { app, protocol } from 'electron';
import { MEDIA_SCHEME } from '@shared/ipc';
import { isSupported } from '@shared/mediaFormats';
import { parseMediaUrl } from '@shared/mediaUrl';
import { serveFile } from './fileStream';
import { Transcoder } from './transcoder';

/**
 * Le renderer est servi en http (dev) ou file (prod) : il ne peut pas charger directement
 * `file://` dans <video>. Les médias locaux passent donc par le schéma `media://` (voir
 * shared/mediaUrl.ts), servi ici par le processus principal :
 *   - media://local/…      fichier brut, servi avec les en-têtes Range (indispensables au seek) ;
 *   - media://transcode/…  flux ffmpeg (audio → AAC, vidéo copiée ou → H.264) quand Chromium ne décode pas.
 */

const transcoder = new Transcoder();

/** À appeler avant app.whenReady(). */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
    },
  ]);
}

/** À appeler après app.whenReady(). */
export function installMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const { host, filePath, start, video } = parseMediaUrl(request.url);
    if (!isSupported(filePath)) {
      return new Response('Format non pris en charge', { status: 415 });
    }
    if (host === 'transcode') {
      return new Response(transcoder.stream(filePath, start, video), {
        status: 200,
        headers: {
          'Content-Type': 'video/x-matroska',
          'Accept-Ranges': 'none',
          'Cache-Control': 'no-store',
        },
      });
    }
    return serveFile(filePath, request.headers.get('range'));
  });
  app.on('before-quit', () => transcoder.killAll());
  app.on('will-quit', () => transcoder.killAll());
}
