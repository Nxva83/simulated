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
  /** Avertissement non bloquant (ex. piste audio non décodable). */
  warning: string | null;
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
};

/**
 * Encapsule l'élément <video> derrière une API stable (open / play / pause / seek / volume).
 * Toute la logique de lecture vit ici ; les composants ne font que de l'affichage.
 */
export function usePlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>(initial);
  const patch = (p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p }));

  // Synchronisation avec les événements du <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = initial.volume;
    const on = (ev: string, fn: () => void) => {
      v.addEventListener(ev, fn);
      return () => v.removeEventListener(ev, fn);
    };
    const offs = [
      on('loadedmetadata', () =>
        patch({
          status: 'ready',
          duration: v.duration,
          hasVideo: v.videoWidth > 0,
        }),
      ),
      on('durationchange', () => patch({ duration: Number.isFinite(v.duration) ? v.duration : 0 })),
      on('timeupdate', () => patch({ position: v.currentTime })),
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

  const open = useCallback(async (path: string) => {
    const v = videoRef.current;
    if (!v) return;
    const pre = preflightError(path);
    if (pre) {
      v.removeAttribute('src');
      v.load();
      patch({ status: 'error', path, playing: false, hasVideo: false, errorMessage: pre });
      return;
    }
    if (!(await window.epikodi.fileExists(path))) {
      patch({
        status: 'error',
        path,
        playing: false,
        hasVideo: false,
        errorMessage: `Fichier introuvable : ${path}`,
      });
      return;
    }
    const { warning } = await window.epikodi.inspectMedia(path);
    patch({
      status: 'loading',
      path,
      position: 0,
      duration: 0,
      hasVideo: !isAudio(path),
      errorMessage: '',
      warning,
    });
    v.src = window.epikodi.toMediaUrl(path);
    try {
      await v.play();
    } catch {
      // L'événement 'error' du <video> porte déjà le diagnostic ; un refus d'autoplay est bénin.
    }
  }, []);

  const play = useCallback(() => void videoRef.current?.play().catch(() => {}), []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const stop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);
  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.src) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);
  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(Math.max(0, seconds), v.duration);
  }, []);
  const seekBy = useCallback(
    (delta: number) => seek((videoRef.current?.currentTime ?? 0) + delta),
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
