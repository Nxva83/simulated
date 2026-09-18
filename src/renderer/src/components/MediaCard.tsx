import type { LibraryItem } from '@shared/library';
import { formatDuration, progressPercent } from '../lib/format';

interface Props {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
  /** Lecture directe (double-clic / touche Lecture) plutôt que la fiche. */
  onPlay?: (item: LibraryItem) => void;
}

/** Carte de bibliothèque : vignette, progression, titre, sous-titre, durée, marqueurs. */
export default function MediaCard({ item, onOpen, onPlay }: Props) {
  const pct =
    item.state && !item.state.watched
      ? progressPercent(item.state.position, item.state.duration ?? item.duration)
      : null;
  return (
    <button
      className={`card ${item.kind}`}
      onClick={() => onOpen(item)}
      onDoubleClick={() => onPlay?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'p' || e.key === 'P') onPlay?.(item);
      }}
      title={item.path}
    >
      <div className={`thumb ${item.kind}`}>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="glyph">{item.kind === 'audio' ? '♫' : '▶'}</span>
        )}
        {item.state?.watched && (
          <span className="badge watched" title="Vu">
            ✓
          </span>
        )}
        {item.state?.favorite && (
          <span className="badge fav" title="Favori">
            ★
          </span>
        )}
        {pct !== null && (
          <div className="progress">
            <div style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="card-title">{item.title}</div>
      <div className="card-meta">
        {item.subtitle && <span className="sub">{item.subtitle}</span>}
        <span>
          {formatDuration(item.duration, item.kind)}
          {item.height ? ` · ${item.height}p` : ''}
        </span>
      </div>
    </button>
  );
}
