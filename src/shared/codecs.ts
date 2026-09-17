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
  /** Durée en secondes lue dans l'en-tête du conteneur (nécessaire au seek en mode transcodé). */
  duration?: number;
  /** Vrai si la piste audio doit être convertie à la volée par ffmpeg (voir main/transcoder.ts). */
  needsTranscode: boolean;
  /** Information non bloquante à afficher, ou null. */
  warning: string | null;
}

export function describeMedia(
  info: Pick<MediaInfo, 'audioCodec' | 'videoCodec' | 'container' | 'duration'>,
): MediaInfo {
  const needsTranscode = isAudioCodecUnsupported(info.audioCodec);
  return {
    ...info,
    needsTranscode,
    warning: needsTranscode
      ? `Piste audio ${info.audioCodec} convertie à la volée (Chromium ne la décode pas) — le seek prend ~1 s.`
      : null,
  };
}
