import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Route =
  | { view: 'home' }
  | { view: 'library'; kind: 'video' | 'audio' }
  | { view: 'series' }
  | { view: 'podcasts' }
  | { view: 'search'; query?: string }
  | { view: 'detail'; id: number }
  | { view: 'player' }
  | { view: 'settings' };

interface Nav {
  route: Route;
  canGoBack: boolean;
  go: (route: Route) => void;
  back: () => void;
}

const NavContext = createContext<Nav | null>(null);

/** Navigation interne avec historique (Retour / Échap / bouton B de la manette). */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ view: 'home' }]);
  const go = useCallback((route: Route) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (JSON.stringify(top) === JSON.stringify(route)) return s;
      return [...s.slice(-49), route];
    });
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const value = useMemo<Nav>(
    () => ({ route: stack[stack.length - 1], canGoBack: stack.length > 1, go, back }),
    [stack, go, back],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav hors NavigationProvider');
  return nav;
}
