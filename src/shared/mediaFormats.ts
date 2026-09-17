/**
 * Formats de fichiers que le lecteur accepte d'ouvrir (décidés par l'extension).
 * Le décodage réel dépend des codecs de Chromium ; cette liste sert à filtrer le dialogue
 * d'ouverture et à produire un message clair avant même de tenter la lecture.
 */
export const VIDEO_EXTENSIONS = [
  'mp4',
  'm4v',
  'mkv',
  'webm',
  'avi',
  'mov',
  'wmv',
  'flv',
  'ts',
  'm2ts',
  'mpg',
  'mpeg',
  '3gp',
  'ogv',
] as const;

export const AUDIO_EXTENSIONS = [
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
] as const;

/** Extension en minuscules sans le point, ou chaîne vide. */
export function extensionOf(pathOrUrl: string): string {
  const withoutQuery = pathOrUrl.split(/[?#]/)[0];
  const base = withoutQuery.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function isVideo(pathOrUrl: string): boolean {
  return (VIDEO_EXTENSIONS as readonly string[]).includes(extensionOf(pathOrUrl));
}

export function isAudio(pathOrUrl: string): boolean {
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extensionOf(pathOrUrl));
}

export function isSupported(pathOrUrl: string): boolean {
  return isVideo(pathOrUrl) || isAudio(pathOrUrl);
}

/** Filtres prêts pour `dialog.showOpenDialog`. */
export function dialogFilters(): { name: string; extensions: string[] }[] {
  return [
    { name: 'Médias', extensions: [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS] },
    { name: 'Vidéos', extensions: [...VIDEO_EXTENSIONS] },
    { name: 'Audio', extensions: [...AUDIO_EXTENSIONS] },
    { name: 'Tous les fichiers', extensions: ['*'] },
  ];
}
