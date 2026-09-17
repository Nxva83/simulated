import { describe, expect, it } from 'vitest';
import {
  MEDIA_ERR_DECODE,
  MEDIA_ERR_NETWORK,
  MEDIA_ERR_SRC_NOT_SUPPORTED,
  messageForMediaError,
  preflightError,
} from '@shared/playerErrors';

describe('preflightError', () => {
  it('accepte un média reconnu', () => {
    expect(preflightError('/films/film.mkv')).toBeNull();
    expect(preflightError('/musique/piste.mp3')).toBeNull();
  });
  it('nomme l’extension refusée', () => {
    expect(preflightError('/tmp/fichier.xyz')).toContain('.xyz');
  });
  it('signale une extension absente', () => {
    expect(preflightError('/tmp/fichier')).toMatch(/extension/);
  });
  it('signale un chemin vide', () => {
    expect(preflightError('')).toMatch(/Aucun fichier/);
  });
});

describe('messageForMediaError', () => {
  it('distingue les codes MediaError', () => {
    expect(messageForMediaError(MEDIA_ERR_NETWORK)).toMatch(/réseau|disque/);
    expect(messageForMediaError(MEDIA_ERR_DECODE)).toMatch(/décoder/);
    expect(messageForMediaError(MEDIA_ERR_SRC_NOT_SUPPORTED)).toMatch(/non pris en charge/);
    expect(messageForMediaError(42)).toMatch(/inconnue/);
  });
  it('mentionne les codecs que Chromium ne décode pas', () => {
    expect(messageForMediaError(MEDIA_ERR_SRC_NOT_SUPPORTED)).toMatch(/HEVC|AC3/);
  });
  it('ajoute le détail technique entre parenthèses', () => {
    expect(messageForMediaError(MEDIA_ERR_DECODE, 'PIPELINE_ERROR_DECODE')).toContain(
      '(PIPELINE_ERROR_DECODE)',
    );
  });
});
