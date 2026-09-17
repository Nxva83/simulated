import { mkdirSync, mkdtempSync, rmSync, writeFileSync, utimesSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }));

const { Library } = await import('../../src/main/db');
const { walk, classify } = await import('../../src/main/scanner/walk');
const { scanSource, indexFile } = await import('../../src/main/scanner/scanner');
const { Thumbnails } = await import('../../src/main/scanner/thumbnails');
const { SourceWatcher } = await import('../../src/main/scanner/watcher');
type InspectedMedia = Awaited<
  ReturnType<typeof import('../../src/main/mediaInspect').inspectMedia>
>;

const FIXTURES = join(__dirname, '..', 'fixtures');
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'epikodi-scan-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function touch(rel: string, content = 'x', mtime?: number) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
  if (mtime) utimesSync(p, mtime, mtime);
  return p;
}

/** Inspection factice : déduit codecs et tags du nom de fichier, compte les appels. */
function fakeInspect() {
  const calls: string[] = [];
  const inspect = async (path: string): Promise<InspectedMedia> => {
    calls.push(path);
    const name = path.split('/').pop()!;
    if (name.includes('faux')) return { transcodeAudio: false, videoSupport: 'unknown' };
    const audio = /\.(mp3|flac)$/.test(name);
    return {
      transcodeAudio: false,
      videoSupport: audio ? 'unknown' : 'native',
      audioCodec: audio ? 'mp3' : 'aac',
      videoCodec: audio ? undefined : 'h264',
      duration: 100,
      width: audio ? undefined : 1920,
      height: audio ? undefined : 1080,
      tags: audio
        ? {
            title: name.replace(/\.\w+$/, ''),
            artist: 'Artiste',
            album: 'Album',
            year: 2020,
            trackNo: 1,
          }
        : undefined,
    };
  };
  return { inspect, calls };
}

describe('walk', () => {
  it('trouve les médias récursivement, ignore les dossiers cachés/système et les autres fichiers', async () => {
    touch('Films/a.mkv');
    touch('Films/Sub/b.mp4');
    touch('Films/.cache/c.mp4');
    touch('Films/@eaDir/d.mp4');
    touch('Films/notes.txt');
    touch('Musique/e.flac');
    const found = [];
    for await (const f of walk(root)) found.push(f.path.slice(root.length + 1));
    expect(found.sort()).toEqual(['Films/Sub/b.mp4', 'Films/a.mkv', 'Musique/e.flac']);
  });

  it('détecte un média sans extension par ses premiers octets (MIME)', async () => {
    const noExt = join(root, 'sans-extension');
    copyFileSync(join(FIXTURES, 'pattern-h264-aac.mp4'), noExt);
    touch('texte-sans-extension', 'juste du texte');
    expect(await classify(noExt)).toBe('video');
    expect(await classify(join(root, 'texte-sans-extension'))).toBeNull();
    expect(await classify('/x/y.mp3')).toBe('audio');
    expect(await classify('/x/y.mkv')).toBe('video');
  });

  it('ne plante pas sur un dossier inaccessible', async () => {
    const found = [];
    for await (const f of walk(join(root, 'inexistant'))) found.push(f);
    expect(found).toEqual([]);
  });
});

describe('scanSource', () => {
  it('indexe, puis ne réinspecte que les fichiers nouveaux ou modifiés (incrémental)', async () => {
    const lib = Library.open(':memory:');
    const source = lib.sources.add(root, 'mixed');
    touch('a.mkv', 'aaaa', 1000);
    touch('b.mp3', 'bbbb', 1000);
    const { inspect, calls } = fakeInspect();
    const events: number[] = [];
    const p1 = await scanSource(lib, source, {
      inspect,
      onProgress: (p) => events.push(p.scanned),
    });
    expect(p1).toMatchObject({
      scanned: 2,
      indexed: 2,
      skipped: 0,
      removed: 0,
      done: true,
      error: null,
    });
    expect(calls).toHaveLength(2);
    expect(events.at(-1)).toBe(2);
    expect(lib.files.byPath(join(root, 'a.mkv'))).toMatchObject({
      videoCodec: 'h264',
      width: 1920,
      sourceId: source.id,
    });
    expect(lib.sources.list()[0].lastScanAt).not.toBeNull();

    // Second passage : rien n'a changé.
    const p2 = await scanSource(lib, source, { inspect });
    expect(p2).toMatchObject({ indexed: 0, skipped: 2 });
    expect(calls).toHaveLength(2);

    // Un fichier modifié (date), un ajouté, un supprimé.
    touch('a.mkv', 'aaaa', 2000);
    touch('c.mp4', 'cccc', 1000);
    rmSync(join(root, 'b.mp3'));
    const p3 = await scanSource(lib, source, { inspect });
    expect(p3).toMatchObject({ indexed: 2, skipped: 0, removed: 1 });
    expect(lib.files.byPath(join(root, 'b.mp3'))?.missingSince).not.toBeNull();
    expect(lib.files.list({ presentOnly: true })).toHaveLength(2);
  });

  it('rejette un fichier à l’extension trompeuse et le retire s’il avait été indexé', async () => {
    const lib = Library.open(':memory:');
    const source = lib.sources.add(root, 'movies');
    const p = touch('faux.mkv', 'texte');
    lib.files.upsert({ path: p, kind: 'video' }); // indexé par une version précédente
    const { inspect } = fakeInspect();
    const r = await scanSource(lib, source, { inspect });
    expect(r.rejected).toBe(1);
    expect(lib.files.byPath(p)).toBeNull();
  });

  it('crée artistes, albums et pistes à partir des tags audio', async () => {
    const lib = Library.open(':memory:');
    const source = lib.sources.add(root, 'music');
    touch('01 - Intro.mp3');
    touch('02 - Suite.flac');
    const { inspect } = fakeInspect();
    await scanSource(lib, source, { inspect });
    expect(lib.music.albums()).toEqual([
      expect.objectContaining({ title: 'Album', artist: 'Artiste', year: 2020, trackCount: 2 }),
    ]);
    const file = lib.files.byPath(join(root, '01 - Intro.mp3'))!;
    expect(file.title).toBe('01 - Intro');
    expect(lib.music.trackForFile(file.id)).toMatchObject({ title: '01 - Intro', trackNo: 1 });
    expect(lib.files.search('intro').some((h) => h.type === 'track')).toBe(true);
    // Retrait de la source : plus d'orphelins.
    lib.sources.remove(source.id);
    lib.music.prune();
    expect(lib.music.albums()).toEqual([]);
    expect(lib.db.prepare('SELECT COUNT(*) c FROM artists').get()).toEqual({ c: 0 });
  });

  it('rapporte une erreur sans lever si le parcours échoue', async () => {
    const lib = Library.open(':memory:');
    const source = lib.sources.add(root, 'mixed');
    // eslint-disable-next-line require-yield
    const walker = async function* () {
      throw new Error('disque débranché');
    };
    const r = await scanSource(lib, source, { walker: walker as never });
    expect(r.done).toBe(true);
    expect(r.error).toMatch(/débranché/);
  });
});

describe('Thumbnails', () => {
  it('nomme les vignettes par id et juge leur fraîcheur par rapport au média', () => {
    const t = new Thumbnails(join(root, 'thumbs'));
    expect(t.pathFor(7)).toBe(join(root, 'thumbs', '7.jpg'));
    expect(t.has(7)).toBe(false);
    expect(t.isFresh(7, 0)).toBe(false);
    writeFileSync(t.pathFor(7), 'jpg');
    expect(t.has(7)).toBe(true);
    expect(t.isFresh(7, 0)).toBe(true);
    expect(t.isFresh(7, Math.floor(Date.now() / 1000) + 3600)).toBe(false);
  });

  it('génère une vraie vignette avec ffmpeg, y compris pour un clip de 3 s', async () => {
    const t = new Thumbnails(join(root, 'thumbs'));
    expect(await t.generate(1, join(FIXTURES, 'pattern-hevc-ac3.mkv'), 3)).toBe(true);
    expect(t.has(1)).toBe(true);
    expect(await t.generate(2, join(FIXTURES, 'tone.mp3'), 3)).toBe(false); // pas de vidéo
    expect(await t.generate(3, join(FIXTURES, 'corrupt.mp4'), null)).toBe(false);
  }, 30000);
});

describe('SourceWatcher', () => {
  it('indexe un fichier ajouté et marque manquant un fichier supprimé', async () => {
    const lib = Library.open(':memory:');
    const source = lib.sources.add(root, 'mixed');
    const { inspect } = fakeInspect();
    // Le watcher utilise l'inspection réelle : on lui donne un vrai média.
    void inspect;
    const events: string[] = [];
    const watcher = new SourceWatcher(lib, undefined, (_s, _p, e) => events.push(e), 200);
    watcher.watch(source);
    await new Promise((r) => setTimeout(r, 300));
    const added = join(root, 'ajout.mp3');
    copyFileSync(join(FIXTURES, 'tone.mp3'), added);
    await vi.waitFor(() => expect(lib.files.byPath(added)).not.toBeNull(), {
      timeout: 8000,
      interval: 100,
    });
    expect(lib.files.byPath(added)).toMatchObject({ kind: 'audio', sourceId: source.id });
    rmSync(added);
    await vi.waitFor(() => expect(lib.files.byPath(added)?.missingSince).not.toBeNull(), {
      timeout: 8000,
      interval: 100,
    });
    expect(events).toEqual(['add', 'unlink']);
    await watcher.close();
  }, 20000);
});

describe('indexFile (fichier réel)', () => {
  it('extrait durée, codecs et résolution d’un vrai MP4 et les tags d’un vrai MP3', async () => {
    const lib = Library.open(':memory:');
    const mp4 = join(FIXTURES, 'pattern-h264-aac.mp4');
    const ok = await indexFile(lib, null, { path: mp4, kind: 'video', size: 1, mtime: 1 });
    expect(ok).toBe(true);
    expect(lib.files.byPath(mp4)).toMatchObject({
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: 320,
      height: 180,
    });
    expect(lib.files.byPath(mp4)!.duration).toBeCloseTo(3, 0);
    const faux = touch('faux.mkv', 'pas une vidéo');
    expect(await indexFile(lib, null, { path: faux, kind: 'video', size: 1, mtime: 1 })).toBe(
      false,
    );
  }, 20000);
});
