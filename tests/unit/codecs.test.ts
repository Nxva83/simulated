import { describe, expect, it } from 'vitest';
import { isAudioCodecUnsupported, warningForMediaInfo } from '@shared/codecs';

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
  it('produit un avertissement nommant le codec', () => {
    expect(warningForMediaInfo({ audioCodec: 'AC3', videoCodec: 'HEVC' })).toMatch(/AC3/);
    expect(warningForMediaInfo({ audioCodec: 'AAC', videoCodec: 'HEVC' })).toBeNull();
  });
});
