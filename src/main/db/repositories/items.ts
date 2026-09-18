import type { DatabaseSync } from 'node:sqlite';
import type {
  HomeData,
  LibraryItem,
  ListOptions,
  MediaDetail,
  PlaybackState,
} from '@shared/library';
import { RESUME_MIN_SECONDS } from './playback';

/** Colonnes d'un élément de bibliothèque : fichier + état de lecture + piste audio. */
const SELECT = `
  SELECT f.*,
         ar.name AS artist_name, al.title AS album_title,
         ps.position AS ps_position, ps.duration AS ps_duration, ps.watched AS ps_watched,
         ps.play_count AS ps_play_count, ps.favorite AS ps_favorite, ps.rating AS ps_rating,
         ps.last_played_at AS ps_last_played_at
  FROM media_files f
  LEFT JOIN tracks t   ON t.media_file_id = f.id
  LEFT JOIN artists ar ON ar.id = COALESCE(t.artist_id, (SELECT artist_id FROM albums WHERE id = t.album_id))
  LEFT JOIN albums al  ON al.id = t.album_id
  LEFT JOIN playback_state ps ON ps.item_type = 'file' AND ps.item_id = f.id`;

const SORT: Record<NonNullable<ListOptions['sort']>, string> = {
  title: 'f.title COLLATE NOCASE',
  added: 'f.added_at',
  duration: 'f.duration',
  lastPlayed: 'ps.last_played_at',
};

type Row = Record<string, unknown>;

export function rowToItem(r: Row): LibraryItem {
  const state: PlaybackState | null =
    r.ps_last_played_at !== null || r.ps_favorite || r.ps_watched || r.ps_rating !== null
      ? {
          type: 'file',
          id: r.id as number,
          position: (r.ps_position as number) ?? 0,
          duration: r.ps_duration as number | null,
          watched: r.ps_watched === 1,
          playCount: (r.ps_play_count as number) ?? 0,
          favorite: r.ps_favorite === 1,
          rating: r.ps_rating as number | null,
          lastPlayedAt: r.ps_last_played_at as number | null,
        }
      : null;
  const path = r.path as string;
  const folder = path.split(/[\\/]/).slice(-2, -1)[0] ?? null;
  const music = [r.artist_name, r.album_title].filter(Boolean).join(' — ');
  return {
    id: r.id as number,
    sourceId: r.source_id as number | null,
    path,
    kind: r.kind as 'video' | 'audio',
    title: r.title as string,
    size: r.size as number | null,
    mtime: r.mtime as number | null,
    duration: r.duration as number | null,
    width: r.width as number | null,
    height: r.height as number | null,
    container: r.container as string | null,
    videoCodec: r.video_codec as string | null,
    audioCodec: r.audio_codec as string | null,
    movieId: r.movie_id as number | null,
    episodeId: r.episode_id as number | null,
    addedAt: r.added_at as number,
    missingSince: r.missing_since as number | null,
    subtitle: r.kind === 'audio' && music ? music : folder,
    state,
  };
}

/** Lectures composites pour l'interface (accueil, listes filtrées, fiche, recherche). */
export class ItemsRepository {
  constructor(private readonly db: DatabaseSync) {}

  list(opts: ListOptions = {}): LibraryItem[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.kind) {
      where.push('f.kind = ?');
      params.push(opts.kind);
    }
    if (opts.presentOnly !== false) where.push('f.missing_since IS NULL');
    switch (opts.filter) {
      case 'unwatched':
        where.push('COALESCE(ps.watched, 0) = 0');
        break;
      case 'watched':
        where.push('ps.watched = 1');
        break;
      case 'favorites':
        where.push('ps.favorite = 1');
        break;
      case 'inProgress':
        where.push('COALESCE(ps.watched, 0) = 0 AND ps.position >= ?');
        params.push(RESUME_MIN_SECONDS);
        break;
    }
    const q = opts.query?.trim();
    if (q) {
      const match = q
        .split(/\s+/)
        .map((t) => t.replace(/["*]/g, ''))
        .filter(Boolean)
        .map((t) => `"${t}"*`)
        .join(' ');
      if (match) {
        where.push(
          `f.id IN (SELECT item_id FROM search_index WHERE item_type = 'file' AND search_index MATCH ?
                    UNION SELECT media_file_id FROM tracks WHERE id IN
                      (SELECT item_id FROM search_index WHERE item_type = 'track' AND search_index MATCH ?))`,
        );
        params.push(match, match);
      }
    }
    const order = opts.order === 'desc' ? 'DESC' : 'ASC';
    const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${SORT[opts.sort ?? 'title']} ${order} NULLS LAST, f.title COLLATE NOCASE
      LIMIT ? OFFSET ?`;
    params.push(opts.limit ?? 500, opts.offset ?? 0);
    return (this.db.prepare(sql).all(...params) as unknown as Row[]).map(rowToItem);
  }

  byId(id: number): LibraryItem | null {
    const r = this.db.prepare(`${SELECT} WHERE f.id = ?`).get(id) as Row | undefined;
    return r ? rowToItem(r) : null;
  }

  byIds(ids: number[]): LibraryItem[] {
    if (ids.length === 0) return [];
    const rows = this.db
      .prepare(
        `${SELECT} WHERE f.id IN (${ids.map(() => '?').join(',')}) AND f.missing_since IS NULL`,
      )
      .all(...ids) as unknown as Row[];
    const byId = new Map(rows.map((r) => [r.id as number, rowToItem(r)]));
    return ids.map((id) => byId.get(id)).filter((x): x is LibraryItem => !!x);
  }

  home(limit = 20): HomeData {
    const count = (kind: string) =>
      (
        this.db
          .prepare('SELECT COUNT(*) c FROM media_files WHERE kind = ? AND missing_since IS NULL')
          .get(kind) as {
          c: number;
        }
      ).c;
    return {
      continueWatching: this.list({
        filter: 'inProgress',
        sort: 'lastPlayed',
        order: 'desc',
        limit,
      }),
      recentlyAdded: this.list({ sort: 'added', order: 'desc', limit }),
      recentlyPlayed: this.list({ sort: 'lastPlayed', order: 'desc', limit }).filter(
        (i) => i.state?.lastPlayedAt,
      ),
      favorites: this.list({ filter: 'favorites', sort: 'lastPlayed', order: 'desc', limit }),
      counts: { video: count('video'), audio: count('audio') },
    };
  }

  detail(id: number): MediaDetail | null {
    const item = this.byId(id);
    if (!item) return null;
    const track = this.db.prepare('SELECT * FROM tracks WHERE media_file_id = ?').get(id) as
      Row | undefined;
    const album = track?.album_id
      ? (this.db.prepare('SELECT * FROM albums WHERE id = ?').get(track.album_id as number) as Row)
      : undefined;
    const artistId = (track?.artist_id ?? album?.artist_id) as number | null | undefined;
    const artist = artistId
      ? (this.db.prepare('SELECT * FROM artists WHERE id = ?').get(artistId) as Row)
      : undefined;
    return {
      item,
      track: track
        ? {
            id: track.id as number,
            mediaFileId: id,
            albumId: track.album_id as number | null,
            artistId: track.artist_id as number | null,
            title: track.title as string,
            discNo: track.disc_no as number | null,
            trackNo: track.track_no as number | null,
            genre: track.genre as string | null,
          }
        : null,
      album: album
        ? {
            id: album.id as number,
            artistId: album.artist_id as number | null,
            title: album.title as string,
            year: album.year as number | null,
            coverPath: album.cover_path as string | null,
          }
        : null,
      artist: artist ? { id: artist.id as number, name: artist.name as string } : null,
    };
  }

  /** Recherche globale : résultats de l'index (fichiers et pistes) résolus en éléments uniques. */
  search(query: string, limit = 50): LibraryItem[] {
    return this.list({ query, limit, sort: 'title' });
  }
}
