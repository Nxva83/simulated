import type { DatabaseSync } from 'node:sqlite';
import {
  titleFromPath,
  type ListOptions,
  type MediaFile,
  type MediaFileInput,
  type SearchHit,
} from '@shared/library';

interface Row {
  id: number;
  source_id: number | null;
  path: string;
  kind: 'video' | 'audio';
  title: string;
  size: number | null;
  mtime: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  container: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  movie_id: number | null;
  episode_id: number | null;
  added_at: number;
  missing_since: number | null;
}

function toMediaFile(r: Row): MediaFile {
  return {
    id: r.id,
    sourceId: r.source_id,
    path: r.path,
    kind: r.kind,
    title: r.title,
    size: r.size,
    mtime: r.mtime,
    duration: r.duration,
    width: r.width,
    height: r.height,
    container: r.container,
    videoCodec: r.video_codec,
    audioCodec: r.audio_codec,
    movieId: r.movie_id,
    episodeId: r.episode_id,
    addedAt: r.added_at,
    missingSince: r.missing_since,
  };
}

const SORT: Record<NonNullable<ListOptions['sort']>, string> = {
  title: 'title COLLATE NOCASE',
  added: 'added_at',
  duration: 'duration',
  lastPlayed: 'added_at', // pas d'état de lecture ici : voir ItemsRepository
};

/** Index des fichiers médias + entretien de l'index de recherche. */
export class MediaFilesRepository {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * Insère ou met à jour (clé : chemin). Les champs absents de `input` ne sont pas écrasés,
   * un fichier réapparu n'est plus « manquant ». Retourne l'enregistrement complet.
   */
  upsert(input: MediaFileInput): MediaFile {
    const title = input.title ?? titleFromPath(input.path);
    this.db
      .prepare(
        `INSERT INTO media_files (path, kind, title, source_id, size, mtime, duration, width, height,
                                  container, video_codec, audio_codec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           kind          = excluded.kind,
           title         = COALESCE(?, media_files.title),
           source_id     = COALESCE(excluded.source_id, media_files.source_id),
           size          = COALESCE(excluded.size, media_files.size),
           mtime         = COALESCE(excluded.mtime, media_files.mtime),
           duration      = COALESCE(excluded.duration, media_files.duration),
           width         = COALESCE(excluded.width, media_files.width),
           height        = COALESCE(excluded.height, media_files.height),
           container     = COALESCE(excluded.container, media_files.container),
           video_codec   = COALESCE(excluded.video_codec, media_files.video_codec),
           audio_codec   = COALESCE(excluded.audio_codec, media_files.audio_codec),
           missing_since = NULL`,
      )
      .run(
        input.path,
        input.kind,
        title,
        input.sourceId ?? null,
        input.size ?? null,
        input.mtime ?? null,
        input.duration ?? null,
        input.width ?? null,
        input.height ?? null,
        input.container ?? null,
        input.videoCodec ?? null,
        input.audioCodec ?? null,
        input.title ?? null,
      );
    const file = this.byPath(input.path)!;
    this.index(file);
    return file;
  }

  byId(id: number): MediaFile | null {
    const r = this.db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as Row | undefined;
    return r ? toMediaFile(r) : null;
  }

  byPath(path: string): MediaFile | null {
    const r = this.db.prepare('SELECT * FROM media_files WHERE path = ?').get(path) as
      Row | undefined;
    return r ? toMediaFile(r) : null;
  }

  list(opts: ListOptions = {}): MediaFile[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.kind) {
      where.push('kind = ?');
      params.push(opts.kind);
    }
    if (opts.presentOnly) where.push('missing_since IS NULL');
    const sql = `SELECT * FROM media_files
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${SORT[opts.sort ?? 'title']} ${opts.order === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?`;
    params.push(opts.limit ?? 200, opts.offset ?? 0);
    return (this.db.prepare(sql).all(...params) as unknown as Row[]).map(toMediaFile);
  }

  count(kind?: 'video' | 'audio'): number {
    const r = (
      kind
        ? this.db.prepare('SELECT COUNT(*) c FROM media_files WHERE kind = ?').get(kind)
        : this.db.prepare('SELECT COUNT(*) c FROM media_files').get()
    ) as { c: number };
    return r.c;
  }

  /** Marque manquants les fichiers d'une source absents de `presentPaths` ; retourne leur nombre. */
  markMissing(sourceId: number, presentPaths: Iterable<string>): number {
    const present = new Set(presentPaths);
    const rows = this.db
      .prepare('SELECT id, path FROM media_files WHERE source_id = ? AND missing_since IS NULL')
      .all(sourceId) as { id: number; path: string }[];
    const stmt = this.db.prepare('UPDATE media_files SET missing_since = unixepoch() WHERE id = ?');
    let n = 0;
    for (const r of rows) {
      if (!present.has(r.path)) {
        stmt.run(r.id);
        n++;
      }
    }
    return n;
  }

  /** Marque un fichier précis comme disparu (watcher). */
  markMissingByPath(path: string): boolean {
    const r = this.db
      .prepare(
        'UPDATE media_files SET missing_since = unixepoch() WHERE path = ? AND missing_since IS NULL',
      )
      .run(path);
    return r.changes > 0;
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
    this.db.prepare("DELETE FROM search_index WHERE item_type = 'file' AND item_id = ?").run(id);
  }

  /** Recherche plein texte (préfixe sur chaque mot), tous types confondus. */
  search(query: string, limit = 50): SearchHit[] {
    const terms = query
      .split(/\s+/)
      .map((t) => t.replace(/["*]/g, ''))
      .filter(Boolean);
    if (terms.length === 0) return [];
    const match = terms.map((t) => `"${t}"*`).join(' ');
    return this.db
      .prepare(
        `SELECT item_type AS type, item_id AS id, title, subtitle
         FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(match, limit) as unknown as SearchHit[];
  }

  private index(file: MediaFile): void {
    const subtitle = file.path.split(/[\\/]/).slice(-2, -1)[0] ?? null;
    this.db
      .prepare("DELETE FROM search_index WHERE item_type = 'file' AND item_id = ?")
      .run(file.id);
    this.db
      .prepare(
        "INSERT INTO search_index (item_type, item_id, title, subtitle) VALUES ('file', ?, ?, ?)",
      )
      .run(file.id, file.title, subtitle);
  }
}
