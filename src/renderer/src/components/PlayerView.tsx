import { useEffect, useRef } from 'react';
import { usePlayer } from '../hooks/usePlayer';

interface Props {
  /** Fichier à ouvrir (argument CLI, association de fichiers). */
  requestedFile: string | null;
  active: boolean;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 && m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function PlayerView({ requestedFile, active }: Props) {
  const { videoRef, state, open, stop, togglePlayPause, seek, seekBy, setVolume, toggleMute } =
    usePlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  const hasMedia = state.status !== 'no-media' && state.status !== 'error';

  useEffect(() => {
    if (requestedFile) void open(requestedFile);
  }, [requestedFile, open]);

  useEffect(() => {
    if (active) rootRef.current?.focus();
  }, [active]);

  const openDialog = async () => {
    const path = await window.epikodi.openFileDialog();
    if (path) void open(path);
    rootRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const handled = true;
    switch (e.key) {
      case ' ':
        togglePlayPause();
        break;
      case 'ArrowLeft':
        seekBy(-10);
        break;
      case 'ArrowRight':
        seekBy(10);
        break;
      case 'ArrowUp':
        setVolume(state.volume + 0.05);
        break;
      case 'ArrowDown':
        setVolume(state.volume - 0.05);
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'o':
      case 'O':
        if (e.ctrlKey || e.metaKey) void openDialog();
        else return;
        break;
      default:
        return;
    }
    if (handled) e.preventDefault();
  };

  const fileName = state.path?.split(/[\\/]/).pop() ?? '';
  const stageIcon =
    state.status === 'error' ? '⚠' : state.status === 'ended' ? '↻' : state.hasVideo ? '▶' : '♫';
  const stageText =
    state.status === 'error'
      ? state.errorMessage
      : state.status === 'ended'
        ? 'Lecture terminée — Espace pour relire'
        : hasMedia
          ? fileName
          : 'Aucun média chargé';

  return (
    <div className="player" ref={rootRef} tabIndex={0} onKeyDown={onKeyDown}>
      <video
        ref={videoRef}
        className={
          state.hasVideo && state.status !== 'ended' && state.status !== 'error' ? '' : 'hidden'
        }
        onClick={togglePlayPause}
        onDoubleClick={openDialog}
      />
      {!(state.hasVideo && state.status !== 'ended' && state.status !== 'error') && (
        <div className={`stage${state.status === 'error' ? ' error' : ''}`}>
          <div className="icon">{stageIcon}</div>
          <div className="text">{stageText}</div>
          <button className="btn" onClick={openDialog}>
            Ouvrir un fichier… (Ctrl+O)
          </button>
        </div>
      )}
      {state.warning && state.status !== 'error' && (
        <div className="warning" role="status">
          ⚠ {state.warning}
        </div>
      )}
      <div className="controls">
        <input
          className="seek"
          type="range"
          min={0}
          max={state.duration || 1}
          step={0.1}
          value={state.position}
          disabled={!hasMedia}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="row">
          <button
            className="icon-btn"
            disabled={!hasMedia}
            onClick={togglePlayPause}
            title="Lecture / pause (Espace)"
          >
            {state.playing ? '⏸' : '▶'}
          </button>
          <button className="icon-btn" disabled={!hasMedia} onClick={stop} title="Stop">
            ⏹
          </button>
          <span className="time">
            {formatTime(state.position)} / {formatTime(state.duration)}
          </span>
          <span className="filename">{hasMedia ? fileName : ''}</span>
          <button className="icon-btn" onClick={toggleMute} title="Muet (M)">
            {state.muted || state.volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.muted ? 0 : state.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <button className="icon-btn" onClick={openDialog} title="Ouvrir (Ctrl+O)">
            📂
          </button>
        </div>
      </div>
    </div>
  );
}
