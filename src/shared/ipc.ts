import type { MediaInfo } from './codecs';
import type {
  ListOptions,
  MediaFile,
  PlaybackState,
  PlayableRef,
  ScanProgress,
  SearchHit,
  Source,
  SourceKind,
} from './library';
import type { MediaUrlOptions } from './mediaUrl';

/** Contrat IPC partagé entre main, preload et renderer. */
export const IPC = {
  openFileDialog: 'dialog:open-file',
  fileExists: 'fs:exists',
  inspectMedia: 'media:inspect',
  openFile: 'app:open-file', // main → renderer : fichier passé en argument ou double-cliqué
  libraryRegisterFile: 'library:register-file',
  libraryList: 'library:list',
  librarySearch: 'library:search',
  libraryFile: 'library:file',
  playbackGet: 'playback:get',
  playbackResume: 'playback:resume',
  playbackStarted: 'playback:started',
  playbackProgress: 'playback:progress',
  playbackSetWatched: 'playback:set-watched',
  playbackSetFavorite: 'playback:set-favorite',
  playbackSetRating: 'playback:set-rating',
  playbackInProgress: 'playback:in-progress',
  playbackRecent: 'playback:recent',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  sourcesList: 'sources:list',
  sourcesAdd: 'sources:add',
  sourcesRemove: 'sources:remove',
  sourcesPickFolder: 'sources:pick-folder',
  scanStart: 'scan:start',
  scanStatus: 'scan:status',
  scanProgress: 'scan:progress', // main → renderer
  libraryChanged: 'library:changed', // main → renderer : fichiers ajoutés/retirés, scan terminé
  dbBackup: 'db:backup',
  dbRestore: 'db:restore',
} as const;

export interface LibraryChange {
  sourceId: number;
  path?: string;
  event: 'add' | 'change' | 'unlink' | 'scan-done' | 'source-removed';
}

/** Schéma personnalisé qui sert les fichiers locaux au renderer (voir main/mediaProtocol.ts). */
export const MEDIA_SCHEME = 'media';

export interface EpikodiApi {
  /** Ouvre le dialogue système et retourne le chemin choisi, ou null. */
  openFileDialog(): Promise<string | null>;
  fileExists(path: string): Promise<boolean>;
  /** Codecs présents dans le conteneur et ce que Chromium peut en décoder. */
  inspectMedia(path: string): Promise<MediaInfo>;
  /** Convertit un chemin local en URL lisible par <video>/<audio> (voir shared/mediaUrl.ts). */
  toMediaUrl(path: string, opts?: MediaUrlOptions): string;
  /** Abonnement aux fichiers à ouvrir (argument CLI, association de fichiers). */
  onOpenFile(cb: (path: string) => void): () => void;
  platform: 'linux' | 'win32' | 'darwin' | string;

  library: {
    /** Enregistre un fichier ouvert (codecs, durée, taille) et retourne son entrée. */
    registerFile(path: string): Promise<MediaFile>;
    list(opts?: ListOptions): Promise<MediaFile[]>;
    search(query: string, limit?: number): Promise<SearchHit[]>;
    file(id: number): Promise<MediaFile | null>;
  };
  playback: {
    get(ref: PlayableRef): Promise<PlaybackState | null>;
    resumePosition(ref: PlayableRef): Promise<number>;
    started(ref: PlayableRef, duration: number | null): Promise<PlaybackState>;
    progress(ref: PlayableRef, position: number, duration: number | null): Promise<PlaybackState>;
    setWatched(ref: PlayableRef, watched: boolean): Promise<PlaybackState>;
    setFavorite(ref: PlayableRef, favorite: boolean): Promise<PlaybackState>;
    setRating(ref: PlayableRef, rating: number | null): Promise<PlaybackState>;
    inProgress(limit?: number): Promise<PlaybackState[]>;
    recent(limit?: number): Promise<PlaybackState[]>;
  };
  settings: {
    get<T>(key: string, fallback: T): Promise<T>;
    set(key: string, value: unknown): Promise<void>;
  };
  sources: {
    list(): Promise<Source[]>;
    /** Ouvre le sélecteur de dossier ; null si annulé. */
    pickFolder(): Promise<string | null>;
    /** Ajoute la source et lance son indexation en tâche de fond. */
    add(path: string, kind: SourceKind): Promise<Source>;
    remove(id: number): Promise<void>;
  };
  scan: {
    /** (Re)lance l'indexation d'une source, ou de toutes si `sourceId` est omis. */
    start(sourceId?: number): Promise<void>;
    status(): Promise<ScanProgress[]>;
    onProgress(cb: (p: ScanProgress) => void): () => void;
  };
  /** La bibliothèque a changé (scan terminé, fichier ajouté/supprimé) : à recharger. */
  onLibraryChanged(cb: (e: LibraryChange) => void): () => void;
  db: {
    /** Ouvre un dialogue et sauvegarde ; retourne le chemin ou null si annulé. */
    backup(): Promise<string | null>;
    /** Ouvre un dialogue et restaure ; retourne faux si annulé. */
    restore(): Promise<boolean>;
  };
}
