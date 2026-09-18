import { useEffect, useState } from 'react';
import type { LibraryItem, ListOptions, MediaKind } from '@shared/library';
import { useNav } from '../lib/navigation';
import MediaCard from './MediaCard';

interface Props {
  kind: MediaKind;
  onPlay: (item: LibraryItem) => void;
}

const SORTS: { value: NonNullable<ListOptions['sort']>; label: string }[] = [
  { value: 'title', label: 'Titre' },
  { value: 'added', label: 'Ajout' },
  { value: 'duration', label: 'Durée' },
  { value: 'lastPlayed', label: 'Dernière lecture' },
];
const FILTERS: { value: NonNullable<ListOptions['filter']>; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'unwatched', label: 'Non vus' },
  { value: 'inProgress', label: 'En cours' },
  { value: 'watched', label: 'Vus' },
  { value: 'favorites', label: 'Favoris' },
];

/** Bibliothèque (Films / Musique) : grille avec tri, filtres et recherche locale. */
export default function LibraryView({ kind, onPlay }: Props) {
  const nav = useNav();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [sort, setSort] = useState<NonNullable<ListOptions['sort']>>('title');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<NonNullable<ListOptions['filter']>>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const title = kind === 'video' ? 'Films' : 'Musique';

  useEffect(() => {
    let alive = true;
    const load = () =>
      window.epikodi.library
        .list({ kind, sort, order, filter, query, presentOnly: true, limit: 2000 })
        .then((f) => alive && setItems(f))
        .catch((e: Error) => alive && setError(e.message));
    void load();
    const off = window.epikodi.onLibraryChanged(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, [kind, sort, order, filter, query]);

  const open = (i: LibraryItem) => nav.go({ view: 'detail', id: i.id });

  return (
    <div className="library view">
      <header className="view-header">
        <h1>{title}</h1>
        {items && (
          <span className="count">
            {items.length} élément{items.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="toolbar">
          <input
            type="search"
            placeholder={`Filtrer ${title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filtrer"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            aria-label="Filtre"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Tri"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            title={order === 'asc' ? 'Croissant' : 'Décroissant'}
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
          >
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </header>
      {error && (
        <div className="placeholder error">
          <p>{error}</p>
        </div>
      )}
      {!error && !items && (
        <div className="placeholder">
          <div className="spinner" />
          <p>Chargement…</p>
        </div>
      )}
      {items && items.length === 0 && (
        <div className="placeholder">
          {query || filter !== 'all' ? (
            <p>Aucun résultat pour ces critères.</p>
          ) : (
            <>
              <p>Bibliothèque vide — ajoutez un dossier dans les réglages.</p>
              <button className="btn primary" onClick={() => nav.go({ view: 'settings' })}>
                Ajouter un dossier
              </button>
            </>
          )}
        </div>
      )}
      {items && items.length > 0 && (
        <div className="grid">
          {items.map((i) => (
            <MediaCard key={i.id} item={i} onOpen={open} onPlay={onPlay} />
          ))}
        </div>
      )}
    </div>
  );
}
