import type { MediaInfo } from './codecs';

/** Contrat IPC partagé entre main, preload et renderer. */
export const IPC = {
  openFileDialog: 'dialog:open-file',
  fileExists: 'fs:exists',
  inspectMedia: 'media:inspect',
  openFile: 'app:open-file', // main → renderer : fichier passé en argument ou double-cliqué
} as const;

/** Schéma personnalisé qui sert les fichiers locaux au renderer (voir main/mediaProtocol.ts). */
export const MEDIA_SCHEME = 'media';

export interface EpikodiApi {
  /** Ouvre le dialogue système et retourne le chemin choisi, ou null. */
  openFileDialog(): Promise<string | null>;
  fileExists(path: string): Promise<boolean>;
  /** Codecs présents dans le conteneur + avertissement éventuel (piste audio non décodable). */
  inspectMedia(path: string): Promise<MediaInfo>;
  /** Convertit un chemin local en URL lisible par <video>/<audio> (voir shared/mediaUrl.ts). */
  toMediaUrl(path: string, opts?: { transcode?: boolean; start?: number }): string;
  /** Abonnement aux fichiers à ouvrir (argument CLI, association de fichiers). */
  onOpenFile(cb: (path: string) => void): () => void;
  platform: 'linux' | 'win32' | 'darwin' | string;
}
