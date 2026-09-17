import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Library } from '../../src/main/db';
import { titleFromPath } from '../../src/shared/library';

let lib: Library;
beforeEach(() => {
  lib = Library.open(':memory:');
});

describe('titleFromPath', () => {
  it('nettoie un nom de fichier', () => {
    expect(titleFromPath('/films/Mon.Film.2024.1080p.mkv')).toBe('Mon Film 2024 1080p');
    expect(titleFromPath('C:\\Musique\\01_intro.flac')).toBe('01 intro');
    expect(titleFromPath('/a/.hidden')).toBe('.hidden');
  });
});

describe('fichiers médias', () => {
  it('insère, relit par chemin et par id, et met à jour sans écraser les champs inconnus', () => {
    const f = lib.files.upsert({
      path: '/films/a.mkv',
      kind: 'video',
      duration: 120,
      videoCodec: 'hevc',
    });
    expect(f.id).toBeGreaterThan(0);
    expect(f.title).toBe('a');
    expect(lib.files.byPath('/films/a.mkv')?.id).toBe(f.id);
    const g = lib.files.upsert({ path: '/films/a.mkv', kind: 'video', width: 1920 });
    expect(g.id).toBe(f.id);
    expect(g.duration).toBe(120);
    expect(g.videoCodec).toBe('hevc');
    expect(g.width).toBe(1920);
    expect(lib.files.count()).toBe(1);
  });

  it('liste avec tri, filtre et pagination', () => {
    lib.files.upsert({ path: '/m/b.mp3', kind: 'audio', title: 'Bravo' });
    lib.files.upsert({ path: '/f/c.mkv', kind: 'video', title: 'charlie' });
    lib.files.upsert({ path: '/f/a.mkv', kind: 'video', title: 'Alpha' });
    expect(lib.files.list().map((f) => f.title)).toEqual(['Alpha', 'Bravo', 'charlie']);
    expect(
      lib.files.list({ kind: 'video', sort: 'title', order: 'desc' }).map((f) => f.title),
    ).toEqual(['charlie', 'Alpha']);
    expect(lib.files.list({ limit: 1, offset: 1 }).map((f) => f.title)).toEqual(['Bravo']);
  });

  it('marque manquants les fichiers disparus d’une source et les réhabilite', () => {
    const src = lib.sources.add('/films', 'movies');
    lib.files.upsert({ path: '/films/a.mkv', kind: 'video', sourceId: src.id });
    lib.files.upsert({ path: '/films/b.mkv', kind: 'video', sourceId: src.id });
    expect(lib.files.markMissing(src.id, ['/films/a.mkv'])).toBe(1);
    expect(lib.files.list({ presentOnly: true }).map((f) => f.path)).toEqual(['/films/a.mkv']);
    lib.files.upsert({ path: '/films/b.mkv', kind: 'video' });
    expect(lib.files.byPath('/films/b.mkv')?.missingSince).toBeNull();
  });

  it('supprime les fichiers d’une source retirée (cascade) et leur entrée de recherche', () => {
    const src = lib.sources.add('/films', 'movies');
    lib.files.upsert({
      path: '/films/a.mkv',
      kind: 'video',
      sourceId: src.id,
      title: 'Interstellar',
    });
    expect(lib.files.search('inter')).toHaveLength(1);
    lib.sources.remove(src.id);
    expect(lib.files.count()).toBe(0);
    expect(lib.files.search('inter')).toHaveLength(0);
    expect(lib.sources.list()).toEqual([]);
  });
});

describe('recherche', () => {
  it('trouve par préfixe de mot, sans accents ni casse, et renvoie le dossier en sous-titre', () => {
    lib.files.upsert({ path: '/films/sf/Interstellar.2014.mkv', kind: 'video' });
    lib.files.upsert({ path: '/musique/Édith Piaf/La vie en rose.flac', kind: 'audio' });
    expect(lib.files.search('inter')[0]).toMatchObject({
      type: 'file',
      title: 'Interstellar 2014',
      subtitle: 'sf',
    });
    expect(lib.files.search('VIE ROSE')).toHaveLength(1);
    expect(lib.files.search('edith')).toHaveLength(1);
    expect(lib.files.search('"*')).toEqual([]);
    expect(lib.files.search('')).toEqual([]);
  });

  it('reste rapide avec plusieurs milliers d’entrées (critère d’acceptation)', () => {
    lib.db.exec('BEGIN');
    for (let i = 0; i < 5000; i++) {
      lib.files.upsert({
        path: `/films/dossier${i % 50}/Film numero ${i} (${1950 + (i % 75)}).mkv`,
        kind: 'video',
        duration: 3600 + i,
      });
    }
    lib.db.exec('COMMIT');
    expect(lib.files.count()).toBe(5000);
    let t0 = performance.now();
    const hits = lib.files.search('numero 42');
    const searchMs = performance.now() - t0;
    expect(hits.length).toBeGreaterThan(0);
    t0 = performance.now();
    const page = lib.files.list({
      kind: 'video',
      sort: 'duration',
      order: 'desc',
      limit: 50,
      offset: 2000,
    });
    const listMs = performance.now() - t0;
    expect(page).toHaveLength(50);
    expect(searchMs, `recherche ${searchMs.toFixed(1)} ms`).toBeLessThan(100);
    expect(listMs, `liste ${listMs.toFixed(1)} ms`).toBeLessThan(100);
  });
});

describe('état de lecture', () => {
  const ref = { type: 'file' as const, id: 1 };

  it('démarre, progresse, propose la reprise, puis passe « vu » au seuil', () => {
    lib.files.upsert({ path: '/f/a.mkv', kind: 'video' });
    expect(lib.playback.get(ref)).toBeNull();
    expect(lib.playback.resumePosition(ref)).toBe(0);
    const s = lib.playback.started(ref, 1000);
    expect(s.playCount).toBe(1);
    lib.playback.progress(ref, 3, 1000);
    expect(lib.playback.resumePosition(ref)).toBe(0); // trop tôt pour reprendre
    lib.playback.progress(ref, 400, 1000);
    expect(lib.playback.resumePosition(ref)).toBe(400);
    expect(lib.playback.inProgress().map((p) => p.id)).toEqual([1]);
    lib.playback.progress(ref, 950, 1000);
    const done = lib.playback.get(ref)!;
    expect(done.watched).toBe(true);
    expect(done.position).toBe(0);
    expect(lib.playback.resumePosition(ref)).toBe(0);
    expect(lib.playback.inProgress()).toEqual([]);
    expect(lib.playback.started(ref, 1000).playCount).toBe(2);
  });

  it('ne propose pas de reprise juste avant la fin', () => {
    lib.playback.progress(ref, 997, 1000);
    expect(lib.playback.get(ref)!.watched).toBe(true);
    lib.playback.setWatched(ref, false);
    lib.playback.progress(ref, 880, 1000); // 88 % : pas vu, mais reprise proposée
    expect(lib.playback.resumePosition(ref)).toBe(880);
  });

  it('gère favoris, notes et historique', () => {
    lib.playback.setFavorite(ref, true);
    lib.playback.setRating(ref, 8);
    expect(lib.playback.get(ref)).toMatchObject({ favorite: true, rating: 8 });
    expect(lib.playback.favorites().map((p) => p.id)).toEqual([1]);
    expect(() => lib.playback.setRating(ref, 11)).toThrow();
    expect(() => lib.playback.setRating(ref, 2.5)).toThrow();
    lib.playback.setRating(ref, null);
    expect(lib.playback.get(ref)!.rating).toBeNull();
    lib.playback.started(ref, null);
    lib.playback.progress(ref, 10, null);
    const h = lib.db.prepare('SELECT position FROM history ORDER BY id DESC LIMIT 1').get() as {
      position: number;
    };
    expect(h.position).toBe(10);
    expect(lib.playback.recent()[0].id).toBe(1);
  });
});

describe('réglages', () => {
  it('stocke n’importe quelle valeur JSON', () => {
    expect(lib.settings.get('theme', 'dark')).toBe('dark');
    lib.settings.set('theme', 'light');
    lib.settings.set('volume', 0.42);
    lib.settings.set('sources', { films: ['/a', '/b'] });
    expect(lib.settings.get('theme', 'dark')).toBe('light');
    expect(lib.settings.get('volume', 1)).toBe(0.42);
    expect(lib.settings.all()).toEqual({
      theme: 'light',
      volume: 0.42,
      sources: { films: ['/a', '/b'] },
    });
    lib.settings.remove('theme');
    expect(lib.settings.get('theme', 'dark')).toBe('dark');
  });
});

describe('persistance, sauvegarde et restauration', () => {
  it('les données survivent à la fermeture/réouverture (critère d’acceptation)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'epikodi-db-'));
    const path = join(dir, 'epikodi.db');
    const a = Library.open(path);
    a.files.upsert({ path: '/f/a.mkv', kind: 'video', title: 'Persistant' });
    a.playback.progress({ type: 'file', id: 1 }, 42, 100);
    a.close();
    const b = Library.open(path);
    expect(b.files.byPath('/f/a.mkv')?.title).toBe('Persistant');
    expect(b.playback.resumePosition({ type: 'file', id: 1 })).toBe(42);
    b.close();
  });

  it('sauvegarde à chaud puis restaure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'epikodi-db-'));
    const path = join(dir, 'epikodi.db');
    const backup = join(dir, 'sauvegarde.db');
    const l = Library.open(path);
    l.files.upsert({ path: '/f/a.mkv', kind: 'video', title: 'Avant' });
    l.backup(backup);
    l.files.upsert({ path: '/f/b.mkv', kind: 'video', title: 'Après' });
    expect(l.files.count()).toBe(2);
    l.restore(backup);
    expect(l.files.count()).toBe(1);
    expect(l.files.byPath('/f/a.mkv')?.title).toBe('Avant');
    expect(l.files.search('avant')).toHaveLength(1);
    l.close();
    expect(() => Library.open(':memory:').restore(backup)).toThrow(/mémoire/);
  });
});
