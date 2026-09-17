import { execFile } from 'node:child_process';
import { parseFile } from 'music-metadata';
import { describeMedia, type MediaInfo } from '@shared/codecs';
import { ffmpegPath } from './transcoder';

// Valeurs de TrackType (Matroska) : 1 = vidéo, 2 = audio. L'enum n'est pas ré-exporté par le paquet.
const TRACK_VIDEO = 1;
const TRACK_AUDIO = 2;

/** Lit les en-têtes du conteneur (sans décoder) pour connaître les codecs présents et la durée. */
export async function inspectMedia(filePath: string): Promise<MediaInfo> {
  const fromMetadata = await inspectWithMusicMetadata(filePath);
  // music-metadata ne connaît pas tous les conteneurs (AVI, TS, WMV…) : ffmpeg complète.
  if (fromMetadata?.videoCodec || fromMetadata?.audioCodec) return fromMetadata;
  return (await inspectWithFfmpeg(filePath)) ?? describeMedia({});
}

async function inspectWithMusicMetadata(filePath: string): Promise<MediaInfo | null> {
  try {
    const { format } = await parseFile(filePath, { duration: false, skipCovers: true });
    const tracks = format.trackInfo ?? [];
    const audio = tracks.find((t) => t.type === TRACK_AUDIO);
    const video = tracks.find((t) => t.type === TRACK_VIDEO);
    return describeMedia({
      container: format.container,
      audioCodec: audio?.codecName ?? format.codec,
      videoCodec: video?.codecName,
      duration: format.duration,
    });
  } catch {
    return null;
  }
}

/** Interprète la sortie de `ffmpeg -i <fichier>` (lignes « Duration: » et « Stream #… »). */
export function parseFfmpegProbe(
  output: string,
): Pick<MediaInfo, 'audioCodec' | 'videoCodec' | 'duration' | 'container'> {
  const info: ReturnType<typeof parseFfmpegProbe> = {};
  const container = /Input #0, ([^,]+),/.exec(output);
  if (container) info.container = container[1];
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output);
  if (dur) info.duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  for (const m of output.matchAll(/Stream #\d+:\d+[^:]*: (Video|Audio): ([a-z0-9_]+)/gi)) {
    if (m[1].toLowerCase() === 'video' && !info.videoCodec) info.videoCodec = m[2];
    if (m[1].toLowerCase() === 'audio' && !info.audioCodec) info.audioCodec = m[2];
  }
  return info;
}

function inspectWithFfmpeg(filePath: string): Promise<MediaInfo | null> {
  return new Promise((resolve) => {
    // Sans fichier de sortie ffmpeg termine en erreur, mais il a déjà décrit l'entrée sur stderr.
    execFile(
      ffmpegPath(),
      ['-hide_banner', '-i', filePath],
      { timeout: 5000, windowsHide: true },
      (_err, _stdout, stderr) => {
        const info = parseFfmpegProbe(stderr ?? '');
        resolve(info.videoCodec || info.audioCodec ? describeMedia(info) : null);
      },
    );
  });
}
