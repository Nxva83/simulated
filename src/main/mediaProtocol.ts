import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { MEDIA_SCHEME } from '@shared/ipc';
import { isSupported } from '@shared/mediaFormats';

/**
 * Le renderer est servi en http (dev) ou file (prod) : il ne peut pas charger directement
 * `file://` dans <video>. On expose donc les médias locaux via `media://local/<chemin>`,
 * servi par le processus principal avec support des requêtes Range (indispensable au seek).
 */
export function toMediaUrl(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter(Boolean).map(encodeURIComponent);
  return `${MEDIA_SCHEME}://local/${segments.join('/')}`;
}

/** Inverse de toMediaUrl : retrouve le chemin local (POSIX `/a/b`, Windows `C:/a/b`). */
export function fromMediaUrl(url: string): string {
  const { pathname } = new URL(url);
  const decoded = decodeURIComponent(pathname);
  return /^\/[A-Za-z]:/.test(decoded) ? decoded.slice(1) : decoded;
}

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
    const filePath = fromMediaUrl(request.url);
    if (!isSupported(filePath)) {
      return new Response('Format non pris en charge', { status: 415 });
    }
    // net.fetch sur file:// gère les en-têtes Range et les types MIME.
    return net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
  });
}
