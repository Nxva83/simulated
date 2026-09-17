import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { migrations, type Migration } from './migrations';

/** Version de schéma courante (`PRAGMA user_version`). */
export function schemaVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/**
 * Applique les migrations manquantes, chacune dans sa propre transaction : en cas d'erreur la base
 * reste à la version précédente, jamais dans un état intermédiaire. Refuse une base plus récente
 * que le code (ouverture par une ancienne version de l'application).
 */
export function runMigrations(db: DatabaseSync, list: Migration[] = migrations): number[] {
  const current = schemaVersion(db);
  const latest = list.at(-1)?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `Base de données trop récente (schéma v${current}, application v${latest}) : mettez à jour EPIKODI.`,
    );
  }
  const applied: number[] = [];
  for (const m of list) {
    if (m.version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
      applied.push(m.version);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${m.version} (${m.name}) échouée : ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
  return applied;
}

/** Ouvre (ou crée) la base, règle les pragmas de performance/intégrité et migre le schéma. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL'); // lectures concurrentes, écritures plus rapides
    db.exec('PRAGMA synchronous = NORMAL');
  }
  runMigrations(db);
  return db;
}

/** Sauvegarde cohérente à chaud (copie compactée), sans bloquer les lectures. */
export function backupDatabase(db: DatabaseSync, destPath: string): void {
  if (existsSync(destPath)) unlinkSync(destPath);
  db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);
}

/**
 * Remplace la base par une sauvegarde. L'appelant doit avoir fermé `db` et rouvrir ensuite.
 * L'ancienne base est conservée en `<path>.before-restore` jusqu'à la prochaine restauration.
 */
export function restoreDatabase(dbPath: string, backupPath: string): void {
  const probe = new DatabaseSync(backupPath, { readOnly: true });
  try {
    if (
      (probe.prepare('PRAGMA integrity_check').get() as { integrity_check: string })
        .integrity_check !== 'ok'
    ) {
      throw new Error('La sauvegarde est corrompue.');
    }
  } finally {
    probe.close();
  }
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
  }
  if (existsSync(dbPath)) renameSync(dbPath, `${dbPath}.before-restore`);
  copyFileSync(backupPath, dbPath);
}
