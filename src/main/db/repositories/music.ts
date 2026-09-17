import type { DatabaseSync } from 'node:sqlite';
import type { Album, Artist, AudioTags, Track } from '@shared/library';

/** Artistes, albums et pistes, alimentés par les tags des fichiers audio (issue #4). */
export class MusicRepository {
  constructor(private readonly db: DatabaseSync) {}

  artist(name: string): Artist {
    this.db.prepare('INSERT INTO artists (name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(name);
    return this.db.prepare('SELECT * FROM artists WHERE name = ?').get(name) as unknown as Artist;
  }

  album(title: string, artistId: number | null, year: number | null): Album {
    this.db
      .prepare(
        `INSERT INTO albums (title, artist_id, year) VALUES (?, ?, ?)
         ON CONFLICT(artist_id, title) DO UPDATE SET year = COALESCE(excluded.year, albums.year)`,
      )
      .run(title, artistId, year);
    const r = this.db
      .prepare('SELECT * FROM albums WHERE title = ? AND artist_id IS ?')
      .get(title, artistId) as Record<string, unknown>;
    return {
      id: r.id as number,
      artistId: r.artist_id as number | null,
      title: r.title as string,
      year: r.year as number | null,
      coverPath: r.cover_path as string | null,
    };
  }

  /**
   * Rattache un fichier audio à sa piste / son album / son artiste d'après ses tags.
   * L'artiste d'album (« Various Artists ») prime sur l'artiste de piste pour regrouper l'album.
   */
  upsertTrack(mediaFileId: number, fallbackTitle: string, tags: AudioTags): Track {
    const artist = tags.artist ? this.artist(tags.artist) : null;
    const albumArtist = tags.albumArtist ? this.artist(tags.albumArtist) : artist;
    const album = tags.album
      ? this.album(tags.album, albumArtist?.id ?? null, tags.year ?? null)
      : null;
    this.db
      .prepare(
        `INSERT INTO tracks (media_file_id, album_id, artist_id, title, disc_no, track_no, genre)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(media_file_id) DO UPDATE SET
           album_id = excluded.album_id, artist_id = excluded.artist_id, title = excluded.title,
           disc_no = excluded.disc_no, track_no = excluded.track_no, genre = excluded.genre`,
      )
      .run(
        mediaFileId,
        album?.id ?? null,
        artist?.id ?? null,
        tags.title ?? fallbackTitle,
        tags.discNo ?? null,
        tags.trackNo ?? null,
        tags.genre ?? null,
      );
    const track = this.trackForFile(mediaFileId)!;
    // Index de recherche : titre + « artiste — album ».
    this.db
      .prepare("DELETE FROM search_index WHERE item_type = 'track' AND item_id = ?")
      .run(track.id);
    this.db
      .prepare(
        "INSERT INTO search_index (item_type, item_id, title, subtitle) VALUES ('track', ?, ?, ?)",
      )
      .run(track.id, track.title, [tags.artist, tags.album].filter(Boolean).join(' — ') || null);
    return track;
  }

  trackForFile(mediaFileId: number): Track | null {
    const r = this.db.prepare('SELECT * FROM tracks WHERE media_file_id = ?').get(mediaFileId) as
      Record<string, unknown> | undefined;
    return r
      ? {
          id: r.id as number,
          mediaFileId: r.media_file_id as number,
          albumId: r.album_id as number | null,
          artistId: r.artist_id as number | null,
          title: r.title as string,
          discNo: r.disc_no as number | null,
          trackNo: r.track_no as number | null,
          genre: r.genre as string | null,
        }
      : null;
  }

  albums(): (Album & { artist: string | null; trackCount: number })[] {
    return (
      this.db
        .prepare(
          `SELECT a.id, a.artist_id, a.title, a.year, a.cover_path, ar.name AS artist,
                  (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
           FROM albums a LEFT JOIN artists ar ON ar.id = a.artist_id
           ORDER BY ar.name COLLATE NOCASE, a.year, a.title COLLATE NOCASE`,
        )
        .all() as unknown as Record<string, unknown>[]
    ).map((r) => ({
      id: r.id as number,
      artistId: r.artist_id as number | null,
      title: r.title as string,
      year: r.year as number | null,
      coverPath: r.cover_path as string | null,
      artist: r.artist as string | null,
      trackCount: r.track_count as number,
    }));
  }

  /** Supprime artistes et albums devenus orphelins (après retrait de fichiers). */
  prune(): void {
    this.db.exec(`
      DELETE FROM albums WHERE id NOT IN (SELECT album_id FROM tracks WHERE album_id IS NOT NULL);
      DELETE FROM artists WHERE id NOT IN (SELECT artist_id FROM tracks WHERE artist_id IS NOT NULL)
        AND id NOT IN (SELECT artist_id FROM albums WHERE artist_id IS NOT NULL);
      DELETE FROM search_index WHERE item_type = 'track' AND item_id NOT IN (SELECT id FROM tracks);
    `);
  }
}
