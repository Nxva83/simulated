import { describe, expect, it } from 'vitest';
import {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  dialogFilters,
  extensionOf,
  isAudio,
  isSupported,
  isVideo,
} from '@shared/mediaFormats';

describe('mediaFormats', () => {
  it('reconnaît vidéo et audio par extension, sans tenir compte de la casse', () => {
    expect(isVideo('/films/Film.MKV')).toBe(true);
    expect(isVideo('C:\\Vidéos\\clip.mp4')).toBe(true);
    expect(isAudio('/musique/piste.flac')).toBe(true);
    expect(isAudio('/films/clip.mp4')).toBe(false);
    expect(isVideo('/musique/piste.flac')).toBe(false);
  });

  it('rejette les extensions inconnues ou absentes', () => {
    expect(isSupported('/tmp/notes.txt')).toBe(false);
    expect(isSupported('/tmp/sans-extension')).toBe(false);
    expect(isSupported('')).toBe(false);
  });

  it('extrait une extension en minuscules sans le point', () => {
    expect(extensionOf('/a/B.Mp4')).toBe('mp4');
    expect(extensionOf('https://ex.org/stream/video.WEBM?x=1#t=3')).toBe('webm');
    expect(extensionOf('/a/README')).toBe('');
    expect(extensionOf('/a/.bashrc')).toBe('');
  });

  it('propose des filtres couvrant toutes les extensions', () => {
    const filters = dialogFilters();
    const all = filters.flatMap((f) => f.extensions);
    for (const e of [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]) expect(all).toContain(e);
    expect(filters.at(-1)?.extensions).toEqual(['*']);
  });
});
