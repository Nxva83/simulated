import type { DatabaseSync } from 'node:sqlite';
import { backupDatabase, openDatabase, restoreDatabase } from './database';
import { MediaFilesRepository } from './repositories/mediaFiles';
import { PlaybackRepository } from './repositories/playback';
import { SettingsRepository } from './repositories/settings';
import { SourcesRepository } from './repositories/sources';

export {
  backupDatabase,
  openDatabase,
  restoreDatabase,
  runMigrations,
  schemaVersion,
} from './database';

/** Façade unique sur la base : une instance par application. */
export class Library {
  readonly files: MediaFilesRepository;
  readonly playback: PlaybackRepository;
  readonly settings: SettingsRepository;
  readonly sources: SourcesRepository;

  private constructor(
    public db: DatabaseSync,
    readonly path: string,
  ) {
    this.files = new MediaFilesRepository(db);
    this.playback = new PlaybackRepository(db);
    this.settings = new SettingsRepository(db);
    this.sources = new SourcesRepository(db);
  }

  static open(path: string): Library {
    return new Library(openDatabase(path), path);
  }

  backup(destPath: string): void {
    backupDatabase(this.db, destPath);
  }

  /** Ferme, remplace le fichier par la sauvegarde, rouvre (migrations appliquées si besoin). */
  restore(backupPath: string): void {
    if (this.path === ':memory:')
      throw new Error('Restauration impossible sur une base en mémoire.');
    this.db.close();
    try {
      restoreDatabase(this.path, backupPath);
    } finally {
      this.db = openDatabase(this.path);
      this.rebind();
    }
  }

  close(): void {
    this.db.close();
  }

  private rebind(): void {
    // Les dépôts gardent une référence à la connexion : on les recrée après réouverture.
    Object.assign(this, {
      files: new MediaFilesRepository(this.db),
      playback: new PlaybackRepository(this.db),
      settings: new SettingsRepository(this.db),
      sources: new SourcesRepository(this.db),
    });
  }
}
