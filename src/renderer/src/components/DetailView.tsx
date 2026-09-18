import { useCallback, useEffect, useState } from 'react';
import type { LibraryItem, MediaDetail } from '@shared/library';
import { formatDate, formatDuration, formatSize, formatTime, progressPercent } from '../lib/format';
import { useNav } from '../lib/navigation';

interface Props {
  id: number;
  onPlay: (item: LibraryItem, fromStart?: boolean) => void;
}

/** Fiche détaillée : visuel, infos techniques, état de lecture, actions. Synopsis/casting : #8. */
export default function DetailView({ id, onPlay }: Props) {
  const nav = useNav();
  // Clé = id : la fiche est remontée (état vierge) quand on change d'élément.
  const [loaded, setLoaded] = useState<{ id: number; detail: MediaDetail | null } | null>(null);
  const detail = loaded?.id === id ? loaded.detail : undefined;

  const load = useCallback(
    () => window.epikodi.library.detail(id).then((d) => setLoaded({ id, detail: d })),
    [id],
  );
  useEffect(() => {
    void load();
    return window.epikodi.onLibraryChanged(() => void load());
  }, [load]);

  if (detail === undefined)
    return (
      <div className="placeholder">
        <div className="spinner" />
        <p>Chargement…</p>
      </div>
    );
  if (detail === null) {
    return (
      <div className="placeholder error">
        <p>Cet élément n’existe plus dans la bibliothèque.</p>
        <button className="btn" onClick={nav.back}>
          Retour
        </button>
      </div>
    );
  }

  const { item, track, album, artist } = detail;
  const ref = { type: 'file' as const, id: item.id };
  const state = item.state;
  const resume =
    state &&
    !state.watched &&
    state.position > 5 &&
    (!state.duration || state.duration - state.position > 5)
      ? state.position
      : 0;
  const pct = resume ? progressPercent(resume, state?.duration ?? item.duration) : null;

  const setWatched = async (w: boolean) => {
    await window.epikodi.playback.setWatched(ref, w);
    await load();
  };
  const toggleFavorite = async () => {
    await window.epikodi.playback.setFavorite(ref, !state?.favorite);
    await load();
  };
  const setRating = async (r: number | null) => {
    await window.epikodi.playback.setRating(ref, state?.rating === r ? null : r);
    await load();
  };

  return (
    <div className="detail view">
      <button className="back" onClick={nav.back} title="Retour (Échap)">
        ← Retour
      </button>
      <div className="detail-body">
        <div className={`poster ${item.kind}`}>
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt="" />
          ) : (
            <span className="glyph">{item.kind === 'audio' ? '♫' : '▶'}</span>
          )}
          {pct !== null && (
            <div className="progress">
              <div style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="detail-main">
          <h1>{track?.title ?? item.title}</h1>
          {(artist || album) && (
            <p className="subtitle">
              {artist?.name}
              {artist && album ? ' — ' : ''}
              {album?.title}
              {album?.year ? ` (${album.year})` : ''}
              {track?.trackNo ? ` · piste ${track.trackNo}` : ''}
            </p>
          )}
          <p className="meta">
            {[
              formatDuration(item.duration, item.kind),
              item.height ? `${item.height}p` : null,
              item.videoCodec?.toUpperCase(),
              item.audioCodec?.toUpperCase(),
              formatSize(item.size),
              track?.genre,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="actions">
            <button className="btn primary" autoFocus onClick={() => onPlay(item)}>
              {resume ? `▶ Reprendre à ${formatTime(resume)}` : '▶ Lire'}
            </button>
            {resume > 0 && (
              <button className="btn" onClick={() => onPlay(item, true)}>
                Depuis le début
              </button>
            )}
            <button className="btn" onClick={() => void setWatched(!state?.watched)}>
              {state?.watched ? 'Marquer non vu' : 'Marquer vu'}
            </button>
            <button className="btn" onClick={() => void toggleFavorite()}>
              {state?.favorite ? '★ Favori' : '☆ Favori'}
            </button>
          </div>

          <div className="rating" role="radiogroup" aria-label="Note">
            <span className="label">Note</span>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={`star${state?.rating && n <= state.rating ? ' on' : ''}`}
                aria-label={`${n} sur 10`}
                onClick={() => void setRating(n)}
              >
                ★
              </button>
            ))}
            {state?.rating != null && <span className="value">{state.rating}/10</span>}
          </div>

          <section className="synopsis">
            <h2>Synopsis</h2>
            <p className="hint">
              Les synopsis, affiches et castings arriveront avec l’intégration TheMovieDB (#8).
            </p>
          </section>

          <section className="facts">
            <h2>Informations</h2>
            <dl>
              {state?.playCount ? (
                <>
                  <dt>Lectures</dt>
                  <dd>{state.playCount}</dd>
                </>
              ) : null}
              {state?.lastPlayedAt ? (
                <>
                  <dt>Dernière lecture</dt>
                  <dd>{formatDate(state.lastPlayedAt)}</dd>
                </>
              ) : null}
              <dt>Ajouté</dt>
              <dd>{formatDate(item.addedAt)}</dd>
              {item.container && (
                <>
                  <dt>Conteneur</dt>
                  <dd>{item.container}</dd>
                </>
              )}
              {item.width && item.height && (
                <>
                  <dt>Résolution</dt>
                  <dd>
                    {item.width} × {item.height}
                  </dd>
                </>
              )}
              <dt>Fichier</dt>
              <dd className="path">{item.path}</dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
