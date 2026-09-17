import { useCallback, useEffect, useRef, useState } from 'react';
import { probeContentType, transcodeNotice, type MediaInfo } from '@shared/codecs';
import { messageForMediaError, preflightError } from '@shared/playerErrors';
import { isAudio } from '@shared/mediaFormats';

/**
 * Un codec « hardware-only » (HEVC) n'est décodé que si la machine a un décodeur matériel :
 * on interroge MediaCapabilities plutôt que de découvrir un écran noir.
 */
async function canDecodeVideo(info: MediaInfo): Promise<boolean> {
  if (info.videoSupport === 'unsupported') return false;
  const contentType = probeContentType(info.videoCodec);
  if (!contentType) return true;
  try {
    const r = await navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      video: { contentType, width: 1920, height: 1080, bitrate: 8_000_000, framerate: 30 },
    });
    return r.supported;
  } catch {
    return true;
  }
}

export type PlayerStatus = 'no-media' | 'loading' | 'ready' | 'ended' | 'error';

export interface PlayerState {
  status: PlayerStatus;
  path: string | null;
  playing: boolean;
  position: number; // secondes
  duration: number; // secondes
  volume: number; // 0..1
  muted: boolean;
  hasVideo: boolean;
  errorMessage: string;
  /** Information non bloquante (ex. piste audio convertie à la volée). */
  warning: string | null;
  /** Vrai quand le flux vient de ffmpeg : le seek relance le flux à la position voulue. */
  transcoding: boolean;
}

const initial: PlayerState = {
  status: 'no-media',
  path: null,
  playing: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  hasVideo: false,
  errorMessage: '',
  warning: null,
  transcoding: false,
};

/**
 * Encapsule l'élément <video> derrière une API stable (open / play / pause / seek / volume).
 * Toute la logique de lecture vit ici ; les composants ne font que de l'affichage.
 *
 * Mode transcodé : le flux ffmpeg n'est pas seekable et commence à `offset` secondes ;
 * la position affichée vaut `offset + video.currentTime` et la durée vient des métadonnées.
 */
export function usePlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>(initial);
  // Contexte du média courant, hors état React (lu dans les handlers d'événements).
  const media = useRef({ path: '', transcode: false, video: false, offset: 0, duration: 0 });
  // load() est défini plus bas ; le handler d'erreur (installé une fois) l'atteint via ce ref.
  const loadRef = useRef<(start: number) => void>(() => {});
  const patch = (p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p }));

  // Synchronisation avec les événements du <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = initial.volume;
    // Toujours lire media.current au moment de l'événement : open() remplace l'objet.
    const duration = () => {
      const m = media.current;
      return m.transcode ? m.duration : Number.isFinite(v.duration) ? v.duration : 0;
    };
    const on = (ev: string, fn: () => void) => {
      v.addEventListener(ev, fn);
      return () => v.removeEventListener(ev, fn);
    };
    const offs = [
      on('loadedmetadata', () =>
        patch({ status: 'ready', duration: duration(), hasVideo: v.videoWidth > 0 }),
      ),
      on('durationchange', () => patch({ duration: duration() })),
      on('timeupdate', () => patch({ position: media.current.offset + v.currentTime })),
      on('play', () => patch({ playing: true, status: 'ready' })),
      on('pause', () => patch({ playing: false })),
      on('ended', () => patch({ playing: false, status: 'ended' })),
      on('volumechange', () => patch({ volume: v.volume, muted: v.muted })),
      on('error', () => {
        const m = media.current;
        const code = v.error?.code ?? 0;
        // Dernier recours : Chromium ne décode pas ce flux et ffmpeg n'a pas encore tout converti
        // (conteneur inconnu de l'inspection, codec mal identifié…) → transcodage complet.
        if (m.path && !(m.transcode && m.video) && (code === 3 || code === 4)) {
          m.transcode = true;
          m.video = true;
          patch({
            transcoding: true,
            duration: m.duration,
            warning:
              'Format non décodé nativement : conversion à la volée en H.264/AAC (sollicite le processeur).',
          });
          loadRef.current(m.offset);
          return;
        }
        patch({
          status: 'error',
          playing: false,
          errorMessage: messageForMediaError(code, v.error?.message || undefined),
        });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  /** Charge (ou recharge à `start` secondes) le média courant dans le <video>. */
  const load = useCallback((start: number) => {
    const v = videoRef.current;
    const m = media.current;
    if (!v) return;
    m.offset = m.transcode ? start : 0;
    v.src = window.epikodi.toMediaUrl(m.path, { transcode: m.transcode, video: m.video, start });
    if (!m.transcode && start > 0) v.currentTime = start;
    v.play().catch(() => {
      // L'événement 'error' du <video> porte déjà le diagnostic ; un refus d'autoplay est bénin.
    });
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const open = useCallback(
    async (path: string) => {
      const v = videoRef.current;
      if (!v) return;
      const fail = (errorMessage: string) => {
        v.removeAttribute('src');
        v.load();
        patch({
          status: 'error',
          path,
          playing: false,
          hasVideo: false,
          errorMessage,
          transcoding: false,
        });
      };
      const pre = preflightError(path);
      if (pre) return fail(pre);
      if (!(await window.epikodi.fileExists(path))) return fail(`Fichier introuvable : ${path}`);

      const info = await window.epikodi.inspectMedia(path);
      const transcodeVideo = !isAudio(path) && !(await canDecodeVideo(info));
      const transcode = info.transcodeAudio || transcodeVideo;
      media.current = {
        path,
        transcode,
        video: transcodeVideo,
        offset: 0,
        duration: info.duration ?? 0,
      };
      patch({
        status: 'loading',
        path,
        position: 0,
        duration: transcode ? (info.duration ?? 0) : 0,
        hasVideo: !isAudio(path),
        errorMessage: '',
        warning: transcodeNotice(info.transcodeAudio, transcodeVideo, info),
        transcoding: transcode,
      });
      load(0);
    },
    [load],
  );

  const play = useCallback(() => void videoRef.current?.play().catch(() => {}), []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const stop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    if (media.current.transcode) {
      media.current.offset = 0;
      v.removeAttribute('src');
      v.load();
      patch({ position: 0 });
    } else {
      v.currentTime = 0;
    }
  }, []);
  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.src && media.current.path) return load(media.current.offset);
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, [load]);
  const seek = useCallback(
    (seconds: number) => {
      const v = videoRef.current;
      const m = media.current;
      if (!v || !m.path) return;
      if (m.transcode) {
        const target = Math.min(Math.max(0, seconds), m.duration || Infinity);
        patch({ position: target });
        load(target);
        return;
      }
      if (!Number.isFinite(v.duration)) return;
      v.currentTime = Math.min(Math.max(0, seconds), v.duration);
    },
    [load],
  );
  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      const m = media.current;
      seek(m.offset + (v?.currentTime ?? 0) + delta);
    },
    [seek],
  );
  const setVolume = useCallback((vol: number) => {
    const v = videoRef.current;
    if (v) v.volume = Math.min(1, Math.max(0, vol));
  }, []);
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }, []);

  return {
    videoRef,
    state,
    open,
    play,
    pause,
    stop,
    togglePlayPause,
    seek,
    seekBy,
    setVolume,
    toggleMute,
  };
}
