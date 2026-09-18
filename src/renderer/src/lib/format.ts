export function formatDuration(
  s: number | null | undefined,
  kind: 'video' | 'audio' = 'video',
): string {
  if (!s) return '';
  if (kind === 'audio') return formatTime(s);
  if (s < 60) return `${Math.round(s)} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`;
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 && m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function formatDate(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return '';
  return new Date(epochSeconds * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Pourcentage de progression d'un élément (0–100), ou null si non commencé. */
export function progressPercent(
  position: number | undefined,
  duration: number | null | undefined,
): number | null {
  if (!position || !duration || duration <= 0) return null;
  return Math.min(100, Math.round((position / duration) * 100));
}
