import type { DatabaseSync } from 'node:sqlite';

/** Réglages clé → valeur JSON. */
export class SettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  get<T>(key: string, fallback: T): T {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      { value: string } | undefined;
    if (!r) return fallback;
    try {
      return JSON.parse(r.value) as T;
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  all(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const r of this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[]) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        /* valeur illisible : ignorée */
      }
    }
    return out;
  }
}
