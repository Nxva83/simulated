import { useEffect } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Navigation spatiale : les flèches déplacent le focus vers l'élément focusable le plus proche
 * dans la direction voulue (grilles, rangées, barre latérale). Fonctionne pour le clavier et,
 * via useGamepad, pour la manette. Les champs texte et curseurs gardent leurs flèches.
 */
export function useSpatialNavigation(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')
      ) {
        const input = active as HTMLInputElement;
        // Un curseur (range) garde gauche/droite ; un champ texte garde tout.
        if (input.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
        if (input.type !== 'range') return;
      }
      if (active?.closest('.player') && !active.closest('.controls')) return; // le lecteur gère ses touches
      const next = findNext(active, e.key);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}

function findNext(from: HTMLElement | null, key: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  );
  if (all.length === 0) return null;
  if (!from || from === document.body) return all[0];
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;
    let primary: number;
    let secondary: number;
    switch (key) {
      case 'ArrowRight':
        primary = dx;
        secondary = Math.abs(dy);
        break;
      case 'ArrowLeft':
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case 'ArrowDown':
        primary = dy;
        secondary = Math.abs(dx);
        break;
      default:
        primary = -dy;
        secondary = Math.abs(dx);
    }
    // L'élément doit être dans la direction demandée, avec un léger chevauchement toléré.
    if (primary <= 4) continue;
    // Favorise l'alignement : un écart latéral coûte plus cher que la distance frontale.
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}
