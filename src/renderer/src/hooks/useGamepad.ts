import { useEffect } from 'react';

/**
 * Manette (API Gamepad) : croix / stick gauche → flèches, A → Entrée, B → Échap (retour),
 * Y → recherche, Start → lecture/pause, épaules → ±10 s. Les événements sont synthétisés en
 * KeyboardEvent sur l'élément actif : toute l'UI clavier fonctionne donc à la manette.
 */
export function useGamepad(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== 'function') return;
    let raf = 0;
    const held = new Map<string, number>(); // touche → prochaine répétition (ms)
    const REPEAT_FIRST = 400;
    const REPEAT_NEXT = 120;

    const press = (key: string) => {
      const target = (document.activeElement as HTMLElement | null) ?? document.body;
      const init = { key, code: key, bubbles: true, cancelable: true };
      const down = new KeyboardEvent('keydown', init);
      target.dispatchEvent(down);
      if (key === 'Enter' && !down.defaultPrevented && target instanceof HTMLElement)
        target.click();
      target.dispatchEvent(new KeyboardEvent('keyup', init));
    };

    const poll = () => {
      const now = performance.now();
      const pads = navigator.getGamepads();
      const active = new Set<string>();
      for (const gp of pads) {
        if (!gp) continue;
        const b = (i: number) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        const map: [boolean, string][] = [
          [b(12) || ay < -0.6, 'ArrowUp'],
          [b(13) || ay > 0.6, 'ArrowDown'],
          [b(14) || ax < -0.6, 'ArrowLeft'],
          [b(15) || ax > 0.6, 'ArrowRight'],
          [b(0), 'Enter'],
          [b(1), 'Escape'],
          [b(3), '/'],
          [b(9), ' '],
          [b(4), 'ArrowLeft'],
          [b(5), 'ArrowRight'],
        ];
        for (const [pressed, key] of map) if (pressed) active.add(key);
      }
      for (const key of active) {
        const next = held.get(key);
        if (next === undefined) {
          press(key);
          held.set(key, now + REPEAT_FIRST);
        } else if (now >= next && key.startsWith('Arrow')) {
          press(key);
          held.set(key, now + REPEAT_NEXT);
        }
      }
      for (const key of [...held.keys()]) if (!active.has(key)) held.delete(key);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}
