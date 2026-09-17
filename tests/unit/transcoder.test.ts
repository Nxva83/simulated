import { describe, expect, it, vi } from 'vitest';

vi.mock('ffmpeg-static', () => ({ default: '/app/app.asar/node_modules/ffmpeg-static/ffmpeg' }));

const { ffmpegPath, transcodeArgs } = await import('../../src/main/transcoder');

describe('transcoder', () => {
  it('copie la vidéo, convertit l’audio en AAC stéréo et écrit un Matroska live sur stdout', () => {
    const args = transcodeArgs('/films/a.mkv', 0);
    expect(args).not.toContain('-ss');
    expect(args.join(' ')).toContain('-i /films/a.mkv');
    expect(args.join(' ')).toContain('-c:v copy');
    expect(args.join(' ')).toContain('-c:a aac');
    expect(args.join(' ')).toContain('-ac 2');
    expect(args.join(' ')).toContain('-f matroska -live 1');
    expect(args.at(-1)).toBe('pipe:1');
  });

  it('réencode la vidéo en H.264 seulement sur demande', () => {
    const args = transcodeArgs('/films/a.mkv', 0, true).join(' ');
    expect(args).toContain('-c:v libx264');
    expect(args).not.toContain('-c:v copy');
    expect(args).toContain('-pix_fmt yuv420p');
  });

  it('place -ss avant -i pour un seek rapide', () => {
    const args = transcodeArgs('/films/a.mkv', 12.345);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args[args.indexOf('-ss') + 1]).toBe('12.345');
  });

  it('pointe hors de l’archive asar une fois packagé', () => {
    expect(ffmpegPath()).toBe('/app/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
  });
});
