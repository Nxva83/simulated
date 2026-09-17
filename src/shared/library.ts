/** Types de la bibliothèque partagés entre main (SQLite) et renderer. */

export type MediaKind = 'video' | 'audio';
export type SourceKind = 'movies' | 'shows' | 'music' | 'mixed';
export type PlayableType = 'file' | 'podcast_episode';

export interface PlayableRef {
  type: PlayableType;
  id: number;
}

export interface MediaFile {
  id: number;
  sourceId: number | null;
  path: string;
  kind: MediaKind;
  title: string;
  size: number | null;
  mtime: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  movieId: number | null;
  episodeId: number | null;
  addedAt: number;
  missingSince: number | null;
}

/** Données connues au moment de l'indexation ou de l'ouverture d'un fichier. */
export interface MediaFileInput {
  path: string;
  kind: MediaKind;
  title?: string;
  sourceId?: number | null;
  size?: number | null;
  mtime?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  container?: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
}

export interface ListOptions {
  kind?: MediaKind;
  sort?: 'title' | 'added' | 'duration';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  /** Exclure les fichiers disparus du disque. */
  presentOnly?: boolean;
}

export interface PlaybackState {
  type: PlayableType;
  id: number;
  position: number;
  duration: number | null;
  watched: boolean;
  playCount: number;
  favorite: boolean;
  rating: number | null;
  lastPlayedAt: number | null;
}

export interface SearchHit {
  type: 'file' | 'movie' | 'show' | 'track' | 'album' | 'artist' | 'podcast' | 'podcast_episode';
  id: number;
  title: string;
  subtitle: string | null;
}

export interface Source {
  id: number;
  path: string;
  kind: SourceKind;
  addedAt: number;
  lastScanAt: number | null;
}

/** Titre lisible déduit d'un nom de fichier : « Mon.Film.2024.1080p.mkv » → « Mon Film 2024 1080p ». */
export function titleFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const noExt = base.replace(/\.[^.]+$/, '');
  return noExt.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim() || base;
}
