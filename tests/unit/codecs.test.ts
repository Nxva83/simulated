import { describe, expect, it } from 'vitest';
import { describeMedia, isAudioCodecUnsupported } from '@shared/codecs';

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
  it('demande le transcodage et l’annonce quand la piste audio n’est pas décodable', () => {
    const ac3 = describeMedia({ audioCodec: 'AC3', videoCodec: 'HEVC', duration: 30 });
    expect(ac3.needsTranscode).toBe(true);
    expect(ac3.warning).toMatch(/AC3/);
    expect(ac3.duration).toBe(30);
    const aac = describeMedia({ audioCodec: 'AAC', videoCodec: 'HEVC' });
    expect(aac.needsTranscode).toBe(false);
    expect(aac.warning).toBeNull();
  });
});
