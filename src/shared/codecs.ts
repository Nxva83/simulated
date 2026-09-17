/**
 * Codecs audio que Chromium (donc Electron) ne décode pas, mesuré sur Electron 44 :
 * la vidéo se lit alors en silence, sans erreur. On prévient l'utilisateur en amont.
 * Voir docs/adr/0002-passage-a-electron.md.
 */
const UNSUPPORTED_AUDIO = /^(AC-?3|E-?AC-?3|EAC3|DTS(-HD)?|TRUEHD|MLP)$/i;

export function isAudioCodecUnsupported(codecName: string | undefined): boolean {
  if (!codecName) return false;
  const name = codecName.replace(/^A_/, '').trim();
  return UNSUPPORTED_AUDIO.test(name);
}

export interface MediaInfo {
  container?: string;
  audioCodec?: string;
  videoCodec?: string;
  /** Avertissement non bloquant à afficher, ou null. */
  warning: string | null;
}

export function warningForMediaInfo(
  info: Pick<MediaInfo, 'audioCodec' | 'videoCodec'>,
): string | null {
  if (isAudioCodecUnsupported(info.audioCodec)) {
    return `Piste audio ${info.audioCodec} : Chromium ne la décode pas, la vidéo sera lue sans son.`;
  }
  return null;
}
