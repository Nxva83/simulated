import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRange, serveFile } from '../../src/main/fileStream';

describe('parseRange', () => {
  it('interprète les formes bytes=a-b, a- et -n', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
  });
  it('rejette les plages invalides', () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('bytes=1000-', 1000)).toBeNull();
    expect(parseRange('bytes=9-3', 1000)).toBeNull();
    expect(parseRange('octets=0-1', 1000)).toBeNull();
  });
});

describe('serveFile', () => {
  it('répond 206 avec Content-Range sur une requête partielle', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'epikodi-'));
    const file = join(dir, 'a.mp4');
    await writeFile(file, Buffer.from('0123456789'));
    const res = await serveFile(file, 'bytes=2-5');
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(res.headers.get('Content-Length')).toBe('4');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(await res.text()).toBe('2345');
  });
  it('répond 200 entier sans Range, 416 hors limites, 404 si absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'epikodi-'));
    const file = join(dir, 'b.mp3');
    await writeFile(file, Buffer.from('abc'));
    const full = await serveFile(file, null);
    expect(full.status).toBe(200);
    expect(full.headers.get('Accept-Ranges')).toBe('bytes');
    expect(await full.text()).toBe('abc');
    expect((await serveFile(file, 'bytes=10-')).status).toBe(416);
    expect((await serveFile(join(dir, 'nope.mp3'), null)).status).toBe(404);
  });
});
