import { useNav, type Route } from '../lib/navigation';

const ITEMS: { route: Route; label: string; icon: string; match: (r: Route) => boolean }[] = [
  { route: { view: 'home' }, label: 'Accueil', icon: '⌂', match: (r) => r.view === 'home' },
  {
    route: { view: 'library', kind: 'video' },
    label: 'Films',
    icon: '🎬',
    match: (r) => r.view === 'library' && r.kind === 'video',
  },
  { route: { view: 'series' }, label: 'Séries', icon: '📺', match: (r) => r.view === 'series' },
  {
    route: { view: 'library', kind: 'audio' },
    label: 'Musique',
    icon: '♫',
    match: (r) => r.view === 'library' && r.kind === 'audio',
  },
  {
    route: { view: 'podcasts' },
    label: 'Podcasts',
    icon: '🎙',
    match: (r) => r.view === 'podcasts',
  },
  { route: { view: 'search' }, label: 'Recherche', icon: '⌕', match: (r) => r.view === 'search' },
  { route: { view: 'player' }, label: 'Lecteur', icon: '▶', match: (r) => r.view === 'player' },
  {
    route: { view: 'settings' },
    label: 'Réglages',
    icon: '⚙',
    match: (r) => r.view === 'settings',
  },
];

export default function Sidebar() {
  const nav = useNav();
  return (
    <nav className="sidebar" aria-label="Navigation">
      <div className="brand">EPIKODI</div>
      {ITEMS.map((item) => (
        <button
          key={item.label}
          className={`nav-item${item.match(nav.route) ? ' active' : ''}`}
          onClick={() => nav.go(item.route)}
          aria-current={item.match(nav.route) ? 'page' : undefined}
        >
          <span className="icon" aria-hidden>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
      <div className="version">v{__APP_VERSION__}</div>
    </nav>
  );
}
