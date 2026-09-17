import { useCallback, useEffect, useRef, useState } from 'react';
import { messageForMediaError, preflightError } from '@shared/playerErrors';
import { isAudio } from '@shared/mediaFormats';

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
  const media = useRef({ path: '', transcode: false, offset: 0, duration: 0 });
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
      on('error', () =>
        patch({
          status: 'error',
          playing: false,
          errorMessage: messageForMediaError(v.error?.code ?? 0, v.error?.message || undefined),
        }),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  /** Charge (ou recharge à `start` secondes) le média courant dans le <video>. */
  const load = useCallback((start: number) => {
    const v = videoRef.current;
    const m = media.current;
    if (!v) return;
    m.offset = m.transcode ? start : 0;
    v.src = window.epikodi.toMediaUrl(m.path, { transcode: m.transcode, start });
    if (!m.transcode && start > 0) v.currentTime = start;
    v.play().catch(() => {
      // L'événement 'error' du <video> porte déjà le diagnostic ; un refus d'autoplay est bénin.
    });
  }, []);

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
      media.current = {
        path,
        transcode: info.needsTranscode,
        offset: 0,
        duration: info.duration ?? 0,
      };
      patch({
        status: 'loading',
        path,
        position: 0,
        duration: info.needsTranscode ? (info.duration ?? 0) : 0,
        hasVideo: !isAudio(path),
        errorMessage: '',
        warning: info.warning,
        transcoding: info.needsTranscode,
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
