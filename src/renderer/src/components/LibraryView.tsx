import { useEffect, useState } from 'react';
import type { MediaFile, MediaKind } from '@shared/library';

interface Props {
  title: string;
  kind: MediaKind;
  onPlay: (file: MediaFile) => void;
}

function formatDuration(s: number | null): string {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`;
}

/**
 * Grille minimale de la bibliothèque (vignette, titre, durée) — la vraie interface arrive avec #13.
 * Se recharge quand l'indexation ajoute ou retire des fichiers.
 */
export default function LibraryView({ title, kind, onPlay }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void window.epikodi.library
        .list({ kind, sort: 'title', presentOnly: true, limit: 1000 })
        .then((f) => {
          if (alive) {
            setFiles(f);
            setLoaded(true);
          }
        });
    load();
    const off = window.epikodi.onLibraryChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, [kind]);

  if (loaded && files.length === 0) {
    return (
      <div className="placeholder">
        <h1>{title}</h1>
        <p>Bibliothèque vide — ajoutez un dossier dans les réglages.</p>
      </div>
    );
  }

  return (
    <div className="library">
      <header>
        <h1>{title}</h1>
        <span className="count">
          {files.length} élément{files.length > 1 ? 's' : ''}
        </span>
      </header>
      <div className="grid">
        {files.map((f) => (
          <button key={f.id} className="card" onClick={() => onPlay(f)} title={f.path}>
            <div className={`thumb ${kind}`}>
              {f.thumbnailUrl ? (
                <img src={f.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <span>{kind === 'audio' ? '♫' : '▶'}</span>
              )}
            </div>
            <div className="card-title">{f.title}</div>
            <div className="card-meta">
              {formatDuration(f.duration)}
              {f.height ? ` · ${f.height}p` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
