import { useEffect, useState } from 'react';
import type { HomeData, LibraryItem } from '@shared/library';
import { useNav } from '../lib/navigation';
import MediaCard from './MediaCard';

interface Props {
  onPlay: (item: LibraryItem) => void;
}

function Row({
  title,
  items,
  onOpen,
  onPlay,
}: {
  title: string;
  items: LibraryItem[];
  onOpen: (i: LibraryItem) => void;
  onPlay: (i: LibraryItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="row-section">
      <h2>{title}</h2>
      <div className="row-scroll">
        {items.map((i) => (
          <MediaCard key={i.id} item={i} onOpen={onOpen} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

/** Accueil : reprendre, ajouts récents, récemment lus, favoris. */
export default function HomeView({ onPlay }: Props) {
  const nav = useNav();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      window.epikodi.library
        .home()
        .then((d) => alive && setData(d))
        .catch((e: Error) => alive && setError(e.message));
    void load();
    const off = window.epikodi.onLibraryChanged(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  const open = (i: LibraryItem) => nav.go({ view: 'detail', id: i.id });

  if (error)
    return (
      <div className="placeholder error">
        <h1>Accueil</h1>
        <p>Impossible de charger la bibliothèque : {error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="placeholder">
        <div className="spinner" />
        <p>Chargement…</p>
      </div>
    );

  const empty = data.counts.video + data.counts.audio === 0;
  return (
    <div className="home view">
      <header className="view-header">
        <h1>Accueil</h1>
        {!empty && (
          <span className="count">
            {data.counts.video} vidéo{data.counts.video > 1 ? 's' : ''} · {data.counts.audio} piste
            {data.counts.audio > 1 ? 's' : ''}
          </span>
        )}
      </header>
      {empty ? (
        <div className="placeholder">
          <p>Votre bibliothèque est vide.</p>
          <button className="btn primary" onClick={() => nav.go({ view: 'settings' })}>
            Ajouter un dossier
          </button>
        </div>
      ) : (
        <>
          <Row title="Reprendre" items={data.continueWatching} onOpen={open} onPlay={onPlay} />
          <Row title="Ajouts récents" items={data.recentlyAdded} onOpen={open} onPlay={onPlay} />
          <Row title="Récemment lus" items={data.recentlyPlayed} onOpen={open} onPlay={onPlay} />
          <Row title="Favoris" items={data.favorites} onOpen={open} onPlay={onPlay} />
        </>
      )}
    </div>
  );
}
