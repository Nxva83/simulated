import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { openDatabase, runMigrations, schemaVersion } from '../../src/main/db/database';
import { migrations } from '../../src/main/db/migrations';
import type { Migration } from '../../src/main/db/migrations';

describe('migrations', () => {
  it('crée le schéma complet sur une base vide', () => {
    const db = openDatabase(':memory:');
    expect(schemaVersion(db)).toBe(migrations.at(-1)!.version);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table') ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    for (const t of [
      'sources',
      'media_files',
      'movies',
      'shows',
      'episodes',
      'artists',
      'albums',
      'tracks',
      'podcasts',
      'podcast_episodes',
      'playlists',
      'playlist_items',
      'playback_state',
      'history',
      'settings',
      'search_index',
    ]) {
      expect(tables, t).toContain(t);
    }
    expect((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(
      1,
    );
  });

  it('est idempotent : une seconde exécution n’applique rien', () => {
    const db = openDatabase(':memory:');
    expect(runMigrations(db)).toEqual([]);
  });

  it('met à jour le schéma sans perte de données (critère d’acceptation)', () => {
    const db = new DatabaseSync(':memory:');
    const v1: Migration = {
      version: 1,
      name: 'v1',
      sql: 'CREATE TABLE films (id INTEGER PRIMARY KEY, titre TEXT NOT NULL);',
    };
    const v2: Migration = {
      version: 2,
      name: 'v2',
      sql: 'ALTER TABLE films ADD COLUMN annee INTEGER; CREATE INDEX idx_films_annee ON films(annee);',
    };
    expect(runMigrations(db, [v1])).toEqual([1]);
    db.prepare("INSERT INTO films (titre) VALUES ('Alien'), ('Heat')").run();
    expect(runMigrations(db, [v1, v2])).toEqual([2]);
    expect(schemaVersion(db)).toBe(2);
    const rows = db.prepare('SELECT titre, annee FROM films ORDER BY titre').all();
    expect(rows).toEqual([
      { titre: 'Alien', annee: null },
      { titre: 'Heat', annee: null },
    ]);
  });

  it('annule une migration qui échoue et reste à la version précédente', () => {
    const db = new DatabaseSync(':memory:');
    const v1: Migration = { version: 1, name: 'v1', sql: 'CREATE TABLE a (x);' };
    const bad: Migration = {
      version: 2,
      name: 'bad',
      sql: 'CREATE TABLE b (y); CREATE TABLE a (dup);',
    };
    runMigrations(db, [v1]);
    expect(() => runMigrations(db, [v1, bad])).toThrow(/Migration 2 \(bad\)/);
    expect(schemaVersion(db)).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
  });

  it('refuse une base plus récente que l’application', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA user_version = 99');
    expect(() => runMigrations(db)).toThrow(/trop récente/);
  });

  it('a des numéros de version strictement croissants', () => {
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].version).toBeGreaterThan(migrations[i - 1].version);
    }
  });
});
