import { describe, expect, it } from 'vitest';
import { parseMediaUrl, toMediaUrl } from '@shared/mediaUrl';

describe('media:// URL', () => {
  it('encode et décode un chemin POSIX avec espaces et accents', () => {
    const path = '/home/user/Vidéos/Mon film (2024).mkv';
    const url = toMediaUrl(path);
    expect(url).toMatch(/^media:\/\/local\//);
    expect(url).not.toContain(' ');
    expect(parseMediaUrl(url)).toEqual({ host: 'local', filePath: path, start: 0 });
  });

  it('encode et décode un chemin Windows', () => {
    const url = toMediaUrl('C:\\Users\\Nova\\Videos\\clip.mp4');
    expect(parseMediaUrl(url).filePath).toBe('C:/Users/Nova/Videos/clip.mp4');
  });

  it('résiste aux caractères réservés d’URL', () => {
    const path = '/data/#1 top? 100%.mp3';
    expect(parseMediaUrl(toMediaUrl(path)).filePath).toBe(path);
  });

  it('porte la position de départ en mode transcodé', () => {
    const url = toMediaUrl('/films/a.mkv', { transcode: true, start: 42.5 });
    expect(url).toMatch(/^media:\/\/transcode\//);
    expect(parseMediaUrl(url)).toEqual({
      host: 'transcode',
      filePath: '/films/a.mkv',
      start: 42.5,
    });
    expect(parseMediaUrl(toMediaUrl('/films/a.mkv', { transcode: true })).start).toBe(0);
    expect(parseMediaUrl('media://transcode/films/a.mkv?t=abc').start).toBe(0);
  });
});
