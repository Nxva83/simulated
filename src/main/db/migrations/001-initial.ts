/**
 * Schéma initial. Socle des issues #4 (indexation), #8 (TMDB), #10 (podcasts), #13 (bibliothèque).
 *
 *   sources ─┬─< media_files >─┬─ movies
 *            │                 ├─ episodes >─ shows
 *            │                 └─ tracks >─ albums >─ artists
 *   podcasts ─< podcast_episodes
 *   playlists ─< playlist_items
 *   playback_state / history : état de lecture polymorphe (fichier ou épisode de podcast)
 *   search_index (FTS5) : recherche globale
 */
export const initial = `
CREATE TABLE sources (
  id            INTEGER PRIMARY KEY,
  path          TEXT    NOT NULL UNIQUE,
  kind          TEXT    NOT NULL CHECK (kind IN ('movies', 'shows', 'music', 'mixed')),
  added_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_scan_at  INTEGER
);

CREATE TABLE media_files (
  id             INTEGER PRIMARY KEY,
  source_id      INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  path           TEXT    NOT NULL UNIQUE,
  kind           TEXT    NOT NULL CHECK (kind IN ('video', 'audio')),
  title          TEXT    NOT NULL,
  size           INTEGER,
  mtime          INTEGER,
  duration       REAL,
  width          INTEGER,
  height         INTEGER,
  container      TEXT,
  video_codec    TEXT,
  audio_codec    TEXT,
  movie_id       INTEGER REFERENCES movies(id)   ON DELETE SET NULL,
  episode_id     INTEGER REFERENCES episodes(id) ON DELETE SET NULL,
  added_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  missing_since  INTEGER
);
CREATE INDEX idx_media_files_kind_title ON media_files(kind, title COLLATE NOCASE);
CREATE INDEX idx_media_files_added     ON media_files(added_at DESC);
CREATE INDEX idx_media_files_source    ON media_files(source_id);
CREATE INDEX idx_media_files_movie     ON media_files(movie_id);
CREATE INDEX idx_media_files_episode   ON media_files(episode_id);

CREATE TABLE movies (
  id             INTEGER PRIMARY KEY,
  tmdb_id        INTEGER UNIQUE,
  title          TEXT    NOT NULL,
  original_title TEXT,
  year           INTEGER,
  overview       TEXT,
  runtime        INTEGER,
  rating         REAL,
  genres         TEXT,
  poster_path    TEXT,
  backdrop_path  TEXT,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_movies_title ON movies(title COLLATE NOCASE);
CREATE INDEX idx_movies_year  ON movies(year);

CREATE TABLE shows (
  id             INTEGER PRIMARY KEY,
  tmdb_id        INTEGER UNIQUE,
  title          TEXT    NOT NULL,
  original_title TEXT,
  year           INTEGER,
  overview       TEXT,
  rating         REAL,
  genres         TEXT,
  poster_path    TEXT,
  backdrop_path  TEXT,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_shows_title ON shows(title COLLATE NOCASE);

CREATE TABLE episodes (
  id          INTEGER PRIMARY KEY,
  show_id     INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  tmdb_id     INTEGER,
  season      INTEGER NOT NULL,
  number      INTEGER NOT NULL,
  title       TEXT,
  overview    TEXT,
  air_date    TEXT,
  still_path  TEXT,
  UNIQUE (show_id, season, number)
);

CREATE TABLE artists (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE albums (
  id          INTEGER PRIMARY KEY,
  artist_id   INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  year        INTEGER,
  cover_path  TEXT,
  UNIQUE (artist_id, title)
);
CREATE INDEX idx_albums_title ON albums(title COLLATE NOCASE);

CREATE TABLE tracks (
  id             INTEGER PRIMARY KEY,
  media_file_id  INTEGER NOT NULL UNIQUE REFERENCES media_files(id) ON DELETE CASCADE,
  album_id       INTEGER REFERENCES albums(id)  ON DELETE SET NULL,
  artist_id      INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  title          TEXT    NOT NULL,
  disc_no        INTEGER,
  track_no       INTEGER,
  genre          TEXT
);
CREATE INDEX idx_tracks_album  ON tracks(album_id, disc_no, track_no);
CREATE INDEX idx_tracks_artist ON tracks(artist_id);

CREATE TABLE podcasts (
  id           INTEGER PRIMARY KEY,
  feed_url     TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  description  TEXT,
  image_url    TEXT,
  added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER
);

CREATE TABLE podcast_episodes (
  id            INTEGER PRIMARY KEY,
  podcast_id    INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  guid          TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  description   TEXT,
  audio_url     TEXT    NOT NULL,
  local_path    TEXT,
  duration      REAL,
  published_at  INTEGER,
  UNIQUE (podcast_id, guid)
);
CREATE INDEX idx_podcast_episodes_date ON podcast_episodes(podcast_id, published_at DESC);

CREATE TABLE playlists (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE playlist_items (
  playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  item_type    TEXT    NOT NULL CHECK (item_type IN ('file', 'podcast_episode')),
  item_id      INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, position)
);

-- État de lecture d'un élément : reprise, vu, favori, note. Un seul enregistrement par élément.
CREATE TABLE playback_state (
  item_type       TEXT    NOT NULL CHECK (item_type IN ('file', 'podcast_episode')),
  item_id         INTEGER NOT NULL,
  position        REAL    NOT NULL DEFAULT 0,
  duration        REAL,
  watched         INTEGER NOT NULL DEFAULT 0,
  play_count      INTEGER NOT NULL DEFAULT 0,
  favorite        INTEGER NOT NULL DEFAULT 0,
  rating          INTEGER CHECK (rating BETWEEN 0 AND 10),
  last_played_at  INTEGER,
  PRIMARY KEY (item_type, item_id)
);
CREATE INDEX idx_playback_recent   ON playback_state(last_played_at DESC);
CREATE INDEX idx_playback_favorite ON playback_state(favorite) WHERE favorite = 1;

-- Journal des lectures (accueil : « reprendre », « récemment lus »).
CREATE TABLE history (
  id         INTEGER PRIMARY KEY,
  item_type  TEXT    NOT NULL,
  item_id    INTEGER NOT NULL,
  played_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  position   REAL    NOT NULL DEFAULT 0
);
CREATE INDEX idx_history_played ON history(played_at DESC);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Recherche globale plein texte (titres et sous-titres : artiste, série, dossier…).
CREATE VIRTUAL TABLE search_index USING fts5(
  item_type UNINDEXED,
  item_id   UNINDEXED,
  title,
  subtitle,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;
