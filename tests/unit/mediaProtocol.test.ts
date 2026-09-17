import { describe, expect, it, vi } from 'vitest';

// Le module importe `electron` : on le remplace, seules les fonctions pures sont testées ici.
vi.mock('electron', () => ({ net: {}, protocol: {} }));

const { fromMediaUrl, toMediaUrl } = await import('../../src/main/mediaProtocol');

describe('media:// URL', () => {
  it('encode et décode un chemin POSIX avec espaces et accents', () => {
    const path = '/home/user/Vidéos/Mon film (2024).mkv';
    const url = toMediaUrl(path);
    expect(url).toMatch(/^media:\/\/local\//);
    expect(url).not.toContain(' ');
    expect(fromMediaUrl(url)).toBe(path);
  });

  it('encode et décode un chemin Windows', () => {
    const url = toMediaUrl('C:\\Users\\Nova\\Videos\\clip.mp4');
    expect(fromMediaUrl(url)).toBe('C:/Users/Nova/Videos/clip.mp4');
  });

  it('résiste aux caractères réservés d’URL', () => {
    const path = '/data/#1 top? 100%.mp3';
    expect(fromMediaUrl(toMediaUrl(path))).toBe(path);
  });
});
