export type Section =
  'films' | 'series' | 'musique' | 'podcasts' | 'fichiers' | 'lecteur' | 'reglages';

const ITEMS: { key: Section; label: string }[] = [
  { key: 'films', label: 'Films' },
  { key: 'series', label: 'Séries' },
  { key: 'musique', label: 'Musique' },
  { key: 'podcasts', label: 'Podcasts' },
  { key: 'fichiers', label: 'Fichiers' },
  { key: 'lecteur', label: 'Lecteur' },
  { key: 'reglages', label: 'Réglages' },
];

interface Props {
  current: Section;
  onSelect: (s: Section) => void;
}

export default function Sidebar({ current, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="brand">EPIKODI</div>
      {ITEMS.map((item) => (
        <button
          key={item.key}
          className={`nav-item${current === item.key ? ' active' : ''}`}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
      <div className="version">v{__APP_VERSION__}</div>
    </nav>
  );
}
