/**
 * Capacités de décodage de Chromium (donc d'Electron), mesurées sur Electron 44 :
 *  - audio AC3 / E-AC3 / DTS / TrueHD : jamais décodés → conversion AAC à la volée ;
 *  - vidéo HEVC : décodée uniquement avec accélération matérielle (VAAPI, D3D11, VideoToolbox),
 *    à sonder via MediaCapabilities ; MPEG-2, MPEG-4 ASP (DivX/Xvid), VC-1, WMV : jamais.
 * Voir docs/adr/0002-passage-a-electron.md et main/transcoder.ts.
 */
const UNSUPPORTED_AUDIO = /^(AC-?3|E-?AC-?3|EAC3|DTS(-HD)?|TRUEHD|MLP)$/i;

export function isAudioCodecUnsupported(codecName: string | undefined): boolean {
  if (!codecName) return false;
  const name = codecName.replace(/^A_/, '').trim();
  return UNSUPPORTED_AUDIO.test(name);
}

export type VideoSupport = 'native' | 'hardware-only' | 'unsupported' | 'unknown';

/** Classe un nom de codec vidéo (tel que rapporté par music-metadata) selon ce que Chromium sait décoder. */
export function videoCodecSupport(codecName: string | undefined): VideoSupport {
  if (!codecName) return 'unknown';
  // Noms music-metadata (« V_MPEGH/ISO/HEVC », « <avc1> ») ou ffmpeg (« hevc », « mpeg4 »).
  const n = codecName.replace(/^V_/, '').toUpperCase();
  if (/HEVC|H\.?265|HVC1|HEV1/.test(n)) return 'hardware-only';
  if (/AVC|H\.?264|VP8|VP9|AV1|THEORA/.test(n)) return 'native';
  if (
    /MPEG4\/ISO\/ASP|MPEG-?4 ?ASP|^MPEG4$|XVID|DIVX|MPEG-?[12]|MPEG[12]VIDEO|VC-?1|WMV|MS\/VFW|MSMPEG|H263|RV[1-4]0|CINEPAK|INDEO/.test(
      n,
    )
  ) {
    return 'unsupported';
  }
  return 'unknown';
}

/** Chaîne `codecs=` à sonder avec MediaCapabilities pour un codec « hardware-only ». */
export function probeContentType(codecName: string | undefined): string | null {
  return videoCodecSupport(codecName) === 'hardware-only'
    ? 'video/mp4; codecs="hev1.1.6.L120.B0"'
    : null;
}

export interface MediaInfo {
  container?: string;
  audioCodec?: string;
  videoCodec?: string;
  /** Durée en secondes lue dans l'en-tête du conteneur (nécessaire au seek en mode transcodé). */
  duration?: number;
  /** La piste audio doit être convertie à la volée par ffmpeg. */
  transcodeAudio: boolean;
  /** Support vidéo tel que déduit du nom de codec ; « hardware-only » est à confirmer côté renderer. */
  videoSupport: VideoSupport;
}

export function describeMedia(
  info: Pick<MediaInfo, 'audioCodec' | 'videoCodec' | 'container' | 'duration'>,
): MediaInfo {
  return {
    ...info,
    transcodeAudio: isAudioCodecUnsupported(info.audioCodec),
    videoSupport: videoCodecSupport(info.videoCodec),
  };
}

/** Message d'information affiché dans le lecteur selon ce qui est converti. */
export function transcodeNotice(audio: boolean, video: boolean, info: MediaInfo): string | null {
  if (video) {
    return `Vidéo ${info.videoCodec ?? ''} non décodable par cette machine : conversion à la volée en H.264 (sollicite le processeur) — le seek prend ~1 s.`;
  }
  if (audio) {
    return `Piste audio ${info.audioCodec ?? ''} convertie à la volée (Chromium ne la décode pas) — le seek prend ~1 s.`;
  }
  return null;
}
