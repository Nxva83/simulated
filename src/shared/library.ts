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
  /** URL de la vignette (media://thumb/<id>.jpg), null si non générée. */
  thumbnailUrl?: string | null;
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
  sort?: 'title' | 'added' | 'duration' | 'lastPlayed';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  /** Exclure les fichiers disparus du disque. */
  presentOnly?: boolean;
  /** Filtre sur l'état de lecture. */
  filter?: 'all' | 'unwatched' | 'watched' | 'favorites' | 'inProgress';
  /** Recherche locale (préfixe de mot, via l'index plein texte). */
  query?: string;
}

/** Fichier média enrichi de son état de lecture et, pour l'audio, de sa piste. */
export interface LibraryItem extends MediaFile {
  /** « Artiste — Album » pour l'audio, nom du dossier sinon. */
  subtitle: string | null;
  state: PlaybackState | null;
}

export interface HomeData {
  /** Commencés et non terminés, du plus récent au plus ancien. */
  continueWatching: LibraryItem[];
  recentlyAdded: LibraryItem[];
  recentlyPlayed: LibraryItem[];
  favorites: LibraryItem[];
  counts: { video: number; audio: number };
}

export interface MediaDetail {
  item: LibraryItem;
  track: Track | null;
  album: Album | null;
  artist: Artist | null;
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

export interface Artist {
  id: number;
  name: string;
}

export interface Album {
  id: number;
  artistId: number | null;
  title: string;
  year: number | null;
  coverPath: string | null;
}

export interface Track {
  id: number;
  mediaFileId: number;
  albumId: number | null;
  artistId: number | null;
  title: string;
  discNo: number | null;
  trackNo: number | null;
  genre: string | null;
}

/** Tags audio (ID3, Vorbis, MP4) tels que lus dans le fichier. */
export interface AudioTags {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: number;
  trackNo?: number;
  discNo?: number;
  genre?: string;
}

export interface ScanProgress {
  sourceId: number;
  path: string;
  /** Fichiers vus jusqu'ici / total connu (le total est estimé au fil du parcours). */
  scanned: number;
  indexed: number;
  skipped: number;
  /** Extension de média mais contenu illisible (fichier renommé, corrompu). */
  rejected: number;
  removed: number;
  /** Fichier en cours. */
  current: string | null;
  done: boolean;
  error: string | null;
  startedAt: number;
}

/** Titre lisible déduit d'un nom de fichier : « Mon.Film.2024.1080p.mkv » → « Mon Film 2024 1080p ». */
export function titleFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const noExt = base.replace(/\.[^.]+$/, '');
  return noExt.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim() || base;
}
