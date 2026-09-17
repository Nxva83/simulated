import type { DatabaseSync } from 'node:sqlite';
import type { PlaybackState, PlayableRef } from '@shared/library';

/** Au-delà de cette fraction de la durée, l'élément est considéré comme vu. */
export const WATCHED_THRESHOLD = 0.9;
/** En deçà de cette position (s), pas de reprise proposée. */
export const RESUME_MIN_SECONDS = 5;

interface Row {
  item_type: PlayableRef['type'];
  item_id: number;
  position: number;
  duration: number | null;
  watched: number;
  play_count: number;
  favorite: number;
  rating: number | null;
  last_played_at: number | null;
}

function toState(r: Row): PlaybackState {
  return {
    type: r.item_type,
    id: r.item_id,
    position: r.position,
    duration: r.duration,
    watched: r.watched === 1,
    playCount: r.play_count,
    favorite: r.favorite === 1,
    rating: r.rating,
    lastPlayedAt: r.last_played_at,
  };
}

/** État de lecture : reprise, vu / non vu, favoris, notes, historique. */
export class PlaybackRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(ref: PlayableRef): PlaybackState | null {
    const r = this.db
      .prepare('SELECT * FROM playback_state WHERE item_type = ? AND item_id = ?')
      .get(ref.type, ref.id) as Row | undefined;
    return r ? toState(r) : null;
  }

  /** Position de reprise, ou 0 si l'élément n'a pas été commencé / est terminé. */
  resumePosition(ref: PlayableRef): number {
    const s = this.get(ref);
    if (!s || s.watched || s.position < RESUME_MIN_SECONDS) return 0;
    if (s.duration && s.duration - s.position < RESUME_MIN_SECONDS) return 0;
    return s.position;
  }

  /** Signale le début d'une lecture : compteur, horodatage, ligne d'historique. */
  started(ref: PlayableRef, duration: number | null): PlaybackState {
    this.db
      .prepare(
        `INSERT INTO playback_state (item_type, item_id, duration, play_count, last_played_at)
         VALUES (?, ?, ?, 1, unixepoch())
         ON CONFLICT(item_type, item_id) DO UPDATE SET
           duration = COALESCE(excluded.duration, playback_state.duration),
           play_count = playback_state.play_count + 1,
           last_played_at = unixepoch()`,
      )
      .run(ref.type, ref.id, duration);
    this.db
      .prepare('INSERT INTO history (item_type, item_id, position) VALUES (?, ?, 0)')
      .run(ref.type, ref.id);
    return this.get(ref)!;
  }

  /** Mémorise la position courante ; passe automatiquement « vu » au-delà du seuil. */
  progress(ref: PlayableRef, position: number, duration: number | null): PlaybackState {
    const watched = duration != null && duration > 0 && position / duration >= WATCHED_THRESHOLD;
    this.db
      .prepare(
        `INSERT INTO playback_state (item_type, item_id, position, duration, watched, last_played_at)
         VALUES (?, ?, ?, ?, ?, unixepoch())
         ON CONFLICT(item_type, item_id) DO UPDATE SET
           position = excluded.position,
           duration = COALESCE(excluded.duration, playback_state.duration),
           watched = MAX(playback_state.watched, excluded.watched),
           last_played_at = unixepoch()`,
      )
      .run(ref.type, ref.id, watched ? 0 : position, duration, watched ? 1 : 0);
    this.db
      .prepare(
        `UPDATE history SET position = ?, played_at = unixepoch()
         WHERE id = (SELECT id FROM history WHERE item_type = ? AND item_id = ? ORDER BY id DESC LIMIT 1)`,
      )
      .run(position, ref.type, ref.id);
    return this.get(ref)!;
  }

  setWatched(ref: PlayableRef, watched: boolean): PlaybackState {
    this.upsertFlag(ref, 'watched', watched ? 1 : 0);
    if (watched) {
      this.db
        .prepare('UPDATE playback_state SET position = 0 WHERE item_type = ? AND item_id = ?')
        .run(ref.type, ref.id);
    }
    return this.get(ref)!;
  }

  setFavorite(ref: PlayableRef, favorite: boolean): PlaybackState {
    this.upsertFlag(ref, 'favorite', favorite ? 1 : 0);
    return this.get(ref)!;
  }

  /** Note de 0 à 10, ou null pour effacer. */
  setRating(ref: PlayableRef, rating: number | null): PlaybackState {
    if (rating !== null && (rating < 0 || rating > 10 || !Number.isInteger(rating))) {
      throw new Error('La note doit être un entier entre 0 et 10.');
    }
    this.upsertFlag(ref, 'rating', rating);
    return this.get(ref)!;
  }

  /** Éléments commencés et non terminés, du plus récent au plus ancien (accueil « Reprendre »). */
  inProgress(limit = 20): PlaybackState[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM playback_state
           WHERE watched = 0 AND position >= ?
           ORDER BY last_played_at DESC LIMIT ?`,
        )
        .all(RESUME_MIN_SECONDS, limit) as unknown as Row[]
    ).map(toState);
  }

  recent(limit = 20): PlaybackState[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM playback_state WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?',
        )
        .all(limit) as unknown as Row[]
    ).map(toState);
  }

  favorites(limit = 100): PlaybackState[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM playback_state WHERE favorite = 1 ORDER BY last_played_at DESC LIMIT ?',
        )
        .all(limit) as unknown as Row[]
    ).map(toState);
  }

  private upsertFlag(
    ref: PlayableRef,
    column: 'watched' | 'favorite' | 'rating',
    value: number | null,
  ): void {
    this.db
      .prepare(
        `INSERT INTO playback_state (item_type, item_id, ${column}) VALUES (?, ?, ?)
         ON CONFLICT(item_type, item_id) DO UPDATE SET ${column} = excluded.${column}`,
      )
      .run(ref.type, ref.id, value);
  }
}
