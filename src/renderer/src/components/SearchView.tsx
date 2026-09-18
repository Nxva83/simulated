import { useEffect, useRef, useState } from 'react';
import type { LibraryItem } from '@shared/library';
import { useNav } from '../lib/navigation';
import MediaCard from './MediaCard';

interface Props {
  initialQuery?: string;
  onPlay: (item: LibraryItem) => void;
}

/** Recherche globale (plein texte sur titres, artistes, albums, dossiers). */
export default function SearchView({ initialQuery = '', onPlay }: Props) {
  const nav = useNav();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    let alive = true;
    const t = setTimeout(() => {
      if (!q) {
        setItems([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      void window.epikodi.library.searchItems(q, 100).then((r) => {
        if (alive) {
          setItems(r);
          setSearching(false);
        }
      });
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="search view">
      <header className="view-header">
        <h1>Recherche</h1>
      </header>
      <input
        ref={input}
        className="search-input"
        type="search"
        placeholder="Titre, artiste, album, dossier…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            (document.querySelector('.search .card') as HTMLElement | null)?.focus();
            e.preventDefault();
          }
        }}
      />
      {query.trim() && !searching && items.length === 0 && (
        <div className="placeholder">
          <p>Aucun résultat pour « {query} ».</p>
        </div>
      )}
      {!query.trim() && (
        <p className="hint center">Tapez pour chercher dans toute la bibliothèque.</p>
      )}
      {items.length > 0 && (
        <div className="grid">
          {items.map((i) => (
            <MediaCard
              key={i.id}
              item={i}
              onOpen={(it) => nav.go({ view: 'detail', id: it.id })}
              onPlay={onPlay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
