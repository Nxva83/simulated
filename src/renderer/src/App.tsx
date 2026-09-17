import { useEffect, useState } from 'react';
import Sidebar, { type Section } from './components/Sidebar';
import PlayerView from './components/PlayerView';

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

  return (
    <div className="app">
      <Sidebar current={section} onSelect={setSection} />
      <main className="main">
        {/* Le lecteur reste monté quand on change de section : la lecture continue. */}
        <div style={{ display: section === 'lecteur' ? 'contents' : 'none' }}>
          <PlayerView requestedFile={fileToOpen} active={section === 'lecteur'} />
        </div>
        {section !== 'lecteur' && (
          <div className="placeholder">
            <h1>{title}</h1>
            <p>Bibliothèque vide — ajoutez une source pour commencer.</p>
          </div>
        )}
      </main>
    </div>
  );
}
