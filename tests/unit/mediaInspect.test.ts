import { describe, expect, it, vi } from 'vitest';

vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));
vi.mock('ffmpeg-static', () => ({ default: '/usr/bin/ffmpeg' }));

const { parseFfmpegProbe } = await import('../../src/main/mediaInspect');

const AVI = `Input #0, avi, from 'xvid.avi':
  Metadata:
    encoder         : Lavf61.7.100
  Duration: 00:01:03.04, start: 0.000000, bitrate: 806 kb/s
  Stream #0:0: Video: mpeg4 (Simple Profile) (xvid / 0x64697678), yuv420p, 320x180 [SAR 1:1 DAR 16:9], 713 kb/s, 25 fps, 25 tbr, 25 tbn
  Stream #0:1: Audio: mp3 (mp3float) (U[0][0][0] / 0x0055), 44100 Hz, mono, fltp, 64 kb/s
At least one output file must be specified`;

describe('parseFfmpegProbe', () => {
  it('extrait conteneur, durée et codecs de la sortie de ffmpeg -i', () => {
    const info = parseFfmpegProbe(AVI);
    expect(info.container).toBe('avi');
    expect(info.duration).toBeCloseTo(63.04, 2);
    expect(info.videoCodec).toBe('mpeg4');
    expect(info.audioCodec).toBe('mp3');
  });
  it('gère les flux avec langue et une sortie vide', () => {
    const out = `Duration: 01:30:00.50, start: 0.000000
  Stream #0:0(eng): Video: hevc (Main 10), yuv420p10le
  Stream #0:1(fre): Audio: dts (DTS-HD MA), 48000 Hz`;
    const info = parseFfmpegProbe(out);
    expect(info.duration).toBe(5400.5);
    expect(info.videoCodec).toBe('hevc');
    expect(info.audioCodec).toBe('dts');
    expect(parseFfmpegProbe('')).toEqual({});
  });
});
