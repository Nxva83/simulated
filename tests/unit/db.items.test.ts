import { beforeEach, describe, expect, it } from 'vitest';
import { Library } from '../../src/main/db';

let lib: Library;
const ref = (id: number) => ({ type: 'file' as const, id });

beforeEach(() => {
  lib = Library.open(':memory:');
  lib.files.upsert({ path: '/films/Alpha.mkv', kind: 'video', duration: 1000 });
  lib.files.upsert({ path: '/films/Beta.mkv', kind: 'video', duration: 2000 });
  lib.files.upsert({ path: '/films/Gamma.mkv', kind: 'video', duration: 3000 });
  const t = lib.files.upsert({
    path: '/musique/piste.mp3',
    kind: 'audio',
    duration: 200,
    title: 'Around the World',
  });
  lib.music.upsertTrack(t.id, t.title, {
    artist: 'Daft Punk',
    album: 'Homework',
    year: 1997,
    trackNo: 7,
  });
  // Alpha : en cours (40 %). Beta : vu + favori + note. Gamma : jamais lu.
  lib.playback.started(ref(1), 1000);
  lib.playback.progress(ref(1), 400, 1000);
  lib.playback.started(ref(2), 2000);
  lib.playback.progress(ref(2), 1950, 2000);
  lib.playback.setFavorite(ref(2), true);
  lib.playback.setRating(ref(2), 9);
  // Les deux lectures ont lieu dans la même seconde : on antidate Alpha pour un ordre déterministe.
  lib.db
    .prepare('UPDATE playback_state SET last_played_at = last_played_at - 60 WHERE item_id = 1')
    .run();
});

describe('items.list', () => {
  it('joint l’état de lecture et le sous-titre (dossier ou artiste — album)', () => {
    const items = lib.items.list({ sort: 'title' });
    expect(items.map((i) => i.title)).toEqual(['Alpha', 'Around the World', 'Beta', 'Gamma']);
    expect(items[0].state).toMatchObject({ position: 400, watched: false });
    expect(items[0].subtitle).toBe('films');
    expect(items[1].subtitle).toBe('Daft Punk — Homework');
    expect(items[2].state).toMatchObject({ watched: true, favorite: true, rating: 9 });
    expect(items[3].state).toBeNull();
  });

  it('filtre par état', () => {
    const titles = (f: Parameters<typeof lib.items.list>[0]) =>
      lib.items.list(f).map((i) => i.title);
    expect(titles({ filter: 'unwatched', kind: 'video' })).toEqual(['Alpha', 'Gamma']);
    expect(titles({ filter: 'watched' })).toEqual(['Beta']);
    expect(titles({ filter: 'favorites' })).toEqual(['Beta']);
    expect(titles({ filter: 'inProgress' })).toEqual(['Alpha']);
  });

  it('trie par durée, ajout et dernière lecture', () => {
    expect(
      lib.items.list({ kind: 'video', sort: 'duration', order: 'desc' }).map((i) => i.title),
    ).toEqual(['Gamma', 'Beta', 'Alpha']);
    const played = lib.items
      .list({ sort: 'lastPlayed', order: 'desc' })
      .filter((i) => i.state?.lastPlayedAt);
    expect(played.map((i) => i.title)).toEqual(['Beta', 'Alpha']);
  });

  it('recherche localement par titre, artiste, album et dossier', () => {
    expect(lib.items.list({ query: 'daft' }).map((i) => i.title)).toEqual(['Around the World']);
    expect(lib.items.list({ query: 'homew' }).map((i) => i.title)).toEqual(['Around the World']);
    expect(lib.items.list({ query: 'films', kind: 'video' })).toHaveLength(3);
    expect(lib.items.list({ query: 'gam' }).map((i) => i.title)).toEqual(['Gamma']);
    expect(lib.items.list({ query: '"*' })).toHaveLength(4); // caractères spéciaux neutralisés → pas de filtre
  });

  it('exclut les fichiers disparus par défaut', () => {
    lib.files.markMissingByPath('/films/Gamma.mkv');
    expect(lib.items.list({ kind: 'video' })).toHaveLength(2);
    expect(lib.items.list({ kind: 'video', presentOnly: false })).toHaveLength(3);
  });
});

describe('items.home', () => {
  it('compose reprendre / ajouts récents / récemment lus / favoris et les compteurs', () => {
    const h = lib.items.home();
    expect(h.continueWatching.map((i) => i.title)).toEqual(['Alpha']);
    expect(h.recentlyAdded).toHaveLength(4);
    expect(h.recentlyPlayed.map((i) => i.title)).toEqual(['Beta', 'Alpha']);
    expect(h.favorites.map((i) => i.title)).toEqual(['Beta']);
    expect(h.counts).toEqual({ video: 3, audio: 1 });
  });
});

describe('items.detail / search', () => {
  it('renvoie la fiche avec piste, album et artiste pour l’audio', () => {
    const d = lib.items.detail(4)!;
    expect(d.item.title).toBe('Around the World');
    expect(d.track).toMatchObject({ trackNo: 7 });
    expect(d.album).toMatchObject({ title: 'Homework', year: 1997 });
    expect(d.artist).toMatchObject({ name: 'Daft Punk' });
    expect(lib.items.detail(1)!.track).toBeNull();
    expect(lib.items.detail(999)).toBeNull();
  });

  it('dédoublonne les résultats fichier / piste de la recherche globale', () => {
    expect(lib.items.search('around')).toHaveLength(1);
    expect(lib.items.byIds([3, 1, 999]).map((i) => i.title)).toEqual(['Gamma', 'Alpha']);
  });
});
