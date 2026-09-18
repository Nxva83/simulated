import { useCallback, useEffect, useState } from 'react';
import type { LibraryItem } from '@shared/library';
import type { PlayRequest } from './lib/play';
import { NavigationProvider, useNav } from './lib/navigation';
import { useGamepad } from './hooks/useGamepad';
import { useSpatialNavigation } from './hooks/useSpatialNavigation';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import LibraryView from './components/LibraryView';
import DetailView from './components/DetailView';
import SearchView from './components/SearchView';
import PlayerView from './components/PlayerView';
import SettingsView from './components/SettingsView';

function Shell() {
  const nav = useNav();
  const [play, setPlay] = useState<PlayRequest | null>(null);
  const [tvMode, setTvMode] = useState(false);

  useSpatialNavigation();
  useGamepad();

  const playItem = useCallback(
    (item: LibraryItem | { path: string }, fromStart = false) => {
      setPlay((p) => ({ path: item.path, fromStart, seq: (p?.seq ?? 0) + 1 }));
      nav.go({ view: 'player' });
    },
    [nav],
  );

  // Fichier passé en argument ou double-cliqué : bascule sur le lecteur.
  useEffect(() => window.epikodi.onOpenFile((path) => playItem({ path })), [playItem]);

  // Mode TV mémorisé.
  useEffect(() => {
    void window.epikodi.settings.get('ui.tvMode', false).then((v) => setTvMode(!!v));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('tv', tvMode);
  }, [tvMode]);
  const toggleTv = () => {
    setTvMode((v) => {
      void window.epikodi.settings.set('ui.tvMode', !v);
      return !v;
    });
  };

  // Raccourcis globaux : Échap / Retour arrière = retour, / = recherche, Ctrl+O = ouvrir, T = mode TV.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if ((e.key === 'Escape' || (e.key === 'Backspace' && !typing)) && nav.canGoBack) {
        if (typing && e.key === 'Escape') el.blur();
        else {
          e.preventDefault();
          nav.back();
        }
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        nav.go({ view: 'search' });
      } else if (
        (e.key === 'o' || e.key === 'O') &&
        (e.ctrlKey || e.metaKey) &&
        nav.route.view !== 'player'
      ) {
        e.preventDefault();
        void window.epikodi.openFileDialog().then((p) => p && playItem({ path: p }));
      } else if ((e.key === 't' || e.key === 'T') && e.ctrlKey) {
        e.preventDefault();
        toggleTv();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nav, playItem]);

  const route = nav.route;
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {/* Le lecteur reste monté quand on change de vue : la lecture continue. */}
        <div style={{ display: route.view === 'player' ? 'contents' : 'none' }}>
          <PlayerView request={play} active={route.view === 'player'} />
        </div>
        <ErrorBoundary key={JSON.stringify(route)}>
          {route.view === 'home' && <HomeView onPlay={playItem} />}
          {route.view === 'library' && <LibraryView kind={route.kind} onPlay={playItem} />}
          {route.view === 'detail' && <DetailView id={route.id} onPlay={playItem} />}
          {route.view === 'search' && <SearchView initialQuery={route.query} onPlay={playItem} />}
          {route.view === 'settings' && <SettingsView tvMode={tvMode} onToggleTv={toggleTv} />}
          {(route.view === 'series' || route.view === 'podcasts') && (
            <div className="placeholder">
              <h1>{route.view === 'series' ? 'Séries' : 'Podcasts'}</h1>
              <p>Bientôt disponible ({route.view === 'series' ? 'issue #8' : 'issue #10'}).</p>
            </div>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <Shell />
    </NavigationProvider>
  );
}
