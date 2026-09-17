import { initial } from './001-initial';

export interface Migration {
  /** Numéro strictement croissant, stocké dans `PRAGMA user_version`. */
  version: number;
  name: string;
  /** Une ou plusieurs instructions SQL, exécutées dans une transaction. */
  sql: string;
}

/** Ordre d'application : ne jamais modifier une migration publiée, en ajouter une nouvelle. */
export const migrations: Migration[] = [{ version: 1, name: 'initial', sql: initial }];
