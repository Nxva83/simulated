import { describe, expect, it } from 'vitest';
import {
  describeMedia,
  isAudioCodecUnsupported,
  probeContentType,
  transcodeNotice,
  videoCodecSupport,
} from '@shared/codecs';

describe('codecs', () => {
  it('identifie les codecs audio que Chromium ne décode pas', () => {
    for (const c of ['AC3', 'A_AC3', 'AC-3', 'EAC3', 'E-AC-3', 'DTS', 'DTS-HD', 'TrueHD']) {
      expect(isAudioCodecUnsupported(c), c).toBe(true);
    }
  });
  it('laisse passer les codecs décodés', () => {
    for (const c of [
      'MPEG-4/AAC',
      'AAC',
      'MPEG 1 Layer 3',
      'FLAC',
      'A_OPUS',
      'Vorbis',
      undefined,
    ]) {
      expect(isAudioCodecUnsupported(c), String(c)).toBe(false);
    }
  });
  it('classe les codecs vidéo selon le support de Chromium', () => {
    expect(videoCodecSupport('MPEGH/ISO/HEVC')).toBe('hardware-only');
    expect(videoCodecSupport('V_MPEGH/ISO/HEVC')).toBe('hardware-only');
    expect(videoCodecSupport('MPEG4/ISO/AVC')).toBe('native');
    expect(videoCodecSupport('<avc1>')).toBe('native');
    expect(videoCodecSupport('V_VP9')).toBe('native');
    expect(videoCodecSupport('V_AV1')).toBe('native');
    expect(videoCodecSupport('MPEG4/ISO/ASP')).toBe('unsupported');
    expect(videoCodecSupport('V_MS/VFW/FOURCC')).toBe('unsupported');
    expect(videoCodecSupport('V_MPEG2')).toBe('unsupported');
    expect(videoCodecSupport(undefined)).toBe('unknown');
  });

  it('ne sonde MediaCapabilities que pour les codecs dépendant du matériel', () => {
    expect(probeContentType('MPEGH/ISO/HEVC')).toMatch(/hev1/);
    expect(probeContentType('MPEG4/ISO/AVC')).toBeNull();
  });

  it('décrit un média : audio à convertir, support vidéo', () => {
    const m = describeMedia({ audioCodec: 'AC3', videoCodec: 'MPEGH/ISO/HEVC', duration: 30 });
    expect(m.transcodeAudio).toBe(true);
    expect(m.videoSupport).toBe('hardware-only');
    expect(m.duration).toBe(30);
    expect(describeMedia({ audioCodec: 'AAC', videoCodec: '<avc1>' }).transcodeAudio).toBe(false);
  });

  it('formule un message selon ce qui est converti', () => {
    const m = describeMedia({ audioCodec: 'AC3', videoCodec: 'MPEGH/ISO/HEVC' });
    expect(transcodeNotice(true, false, m)).toMatch(/AC3/);
    expect(transcodeNotice(true, true, m)).toMatch(/HEVC.*H\.264/);
    expect(transcodeNotice(false, false, m)).toBeNull();
  });
});

describe('noms de codecs ffmpeg', () => {
  it('sont classés comme ceux de music-metadata', () => {
    expect(videoCodecSupport('hevc')).toBe('hardware-only');
    expect(videoCodecSupport('h264')).toBe('native');
    expect(videoCodecSupport('vp9')).toBe('native');
    expect(videoCodecSupport('mpeg4')).toBe('unsupported');
    expect(videoCodecSupport('mpeg2video')).toBe('unsupported');
    expect(videoCodecSupport('msmpeg4v3')).toBe('unsupported');
    expect(videoCodecSupport('wmv3')).toBe('unsupported');
    expect(isAudioCodecUnsupported('dts')).toBe(true);
    expect(isAudioCodecUnsupported('eac3')).toBe(true);
    expect(isAudioCodecUnsupported('mp3')).toBe(false);
  });
});
