import { useEffect, useState } from 'react';
import type { MediaFile } from '@shared/library';
import Sidebar, { type Section } from './components/Sidebar';
import PlayerView from './components/PlayerView';
import LibraryView from './components/LibraryView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [section, setSection] = useState<Section>('films');
  const [fileToOpen, setFileToOpen] = useState<string | null>(null);

  // Fichier passé en argument ou double-cliqué : bascule sur le lecteur.
  useEffect(
    () =>
      window.epikodi.onOpenFile((path) => {
        setFileToOpen(path);
        setSection('lecteur');
      }),
    [],
  );

  const title = section.charAt(0).toUpperCase() + section.slice(1);
  const play = (file: MediaFile) => {
    setFileToOpen(file.path);
    setSection('lecteur');
  };

  return (
    <div className="app">
      <Sidebar current={section} onSelect={setSection} />
      <main className="main">
        {/* Le lecteur reste monté quand on change de section : la lecture continue. */}
        <div style={{ display: section === 'lecteur' ? 'contents' : 'none' }}>
          <PlayerView requestedFile={fileToOpen} active={section === 'lecteur'} />
        </div>
        {section === 'films' && <LibraryView title="Films" kind="video" onPlay={play} />}
        {section === 'musique' && <LibraryView title="Musique" kind="audio" onPlay={play} />}
        {section === 'reglages' && <SettingsView />}
        {(section === 'series' || section === 'podcasts' || section === 'fichiers') && (
          <div className="placeholder">
            <h1>{title}</h1>
            <p>Bientôt disponible.</p>
          </div>
        )}
      </main>
    </div>
  );
}
