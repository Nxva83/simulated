import { execFile } from 'node:child_process';
import { parseFile } from 'music-metadata';
import { describeMedia, type MediaInfo } from '@shared/codecs';
import type { AudioTags } from '@shared/library';
import { isAudio } from '@shared/mediaFormats';
import { ffmpegPath } from './transcoder';

// Valeurs de TrackType (Matroska) : 1 = vidéo, 2 = audio. L'enum n'est pas ré-exporté par le paquet.
const TRACK_VIDEO = 1;
const TRACK_AUDIO = 2;

/** Résultat d'inspection enrichi pour l'indexation : résolution et tags audio. */
export interface InspectedMedia extends MediaInfo {
  width?: number;
  height?: number;
  tags?: AudioTags;
}

/**
 * Lit les en-têtes du conteneur (sans décoder) : codecs, durée, résolution, tags.
 * Audio : music-metadata (tags ID3/Vorbis/MP4) puis ffmpeg en secours. Vidéo ou inconnu : ffmpeg
 * fait foi (music-metadata ne type pas la piste vidéo des MP4 et ne donne pas la résolution),
 * enrichi des tags et de la durée de music-metadata quand il sait lire le conteneur.
 */
export async function inspectMedia(filePath: string): Promise<InspectedMedia> {
  const fromMetadata = await inspectWithMusicMetadata(filePath);
  if (isAudio(filePath) && fromMetadata?.audioCodec) return fromMetadata;
  const fromFfmpeg = await inspectWithFfmpeg(filePath);
  if (fromMetadata && fromFfmpeg) {
    return {
      ...fromFfmpeg,
      tags: fromMetadata.tags,
      duration: fromMetadata.duration ?? fromFfmpeg.duration,
    };
  }
  return fromFfmpeg ?? fromMetadata ?? describeMedia({});
}

/** Vrai si l'inspection a trouvé au moins un flux audio ou vidéo : sinon ce n'est pas un média. */
export function isPlayable(info: InspectedMedia): boolean {
  return Boolean(info.videoCodec || info.audioCodec);
}

async function inspectWithMusicMetadata(filePath: string): Promise<InspectedMedia | null> {
  try {
    const { format, common } = await parseFile(filePath, { duration: false, skipCovers: true });
    const tracks = format.trackInfo ?? [];
    const audio = tracks.find((t) => t.type === TRACK_AUDIO);
    const video = tracks.find((t) => t.type === TRACK_VIDEO);
    const info = describeMedia({
      container: format.container,
      audioCodec: audio?.codecName ?? format.codec,
      videoCodec: video?.codecName,
      duration: format.duration,
    });
    const tags: AudioTags = {
      title: common.title || undefined,
      artist: common.artist || undefined,
      albumArtist: common.albumartist || undefined,
      album: common.album || undefined,
      year: common.year || undefined,
      trackNo: common.track?.no ?? undefined,
      discNo: common.disk?.no ?? undefined,
      genre: common.genre?.[0] || undefined,
    };
    const hasTags = Object.values(tags).some((v) => v !== undefined);
    return { ...info, tags: hasTags ? tags : undefined };
  } catch {
    return null;
  }
}

/** Interprète la sortie de `ffmpeg -i <fichier>` (lignes « Duration: » et « Stream #… »). */
export function parseFfmpegProbe(
  output: string,
): Pick<
  InspectedMedia,
  'audioCodec' | 'videoCodec' | 'duration' | 'container' | 'width' | 'height'
> {
  const info: ReturnType<typeof parseFfmpegProbe> = {};
  const container = /Input #0, ([^,]+),/.exec(output);
  if (container) info.container = container[1];
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output);
  if (dur) info.duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  for (const m of output.matchAll(/Stream #\d+:\d+[^:]*: (Video|Audio): ([a-z0-9_]+)([^\n]*)/gi)) {
    if (m[1].toLowerCase() === 'video' && !info.videoCodec) {
      info.videoCodec = m[2];
      const res = /\b(\d{2,5})x(\d{2,5})\b/.exec(m[3]);
      if (res) {
        info.width = Number(res[1]);
        info.height = Number(res[2]);
      }
    }
    if (m[1].toLowerCase() === 'audio' && !info.audioCodec) info.audioCodec = m[2];
  }
  return info;
}

function inspectWithFfmpeg(filePath: string): Promise<InspectedMedia | null> {
  return new Promise((resolve) => {
    // Sans fichier de sortie ffmpeg termine en erreur, mais il a déjà décrit l'entrée sur stderr.
    execFile(
      ffmpegPath(),
      ['-hide_banner', '-i', filePath],
      { timeout: 5000, windowsHide: true },
      (_err, _stdout, stderr) => {
        const info = parseFfmpegProbe(stderr ?? '');
        resolve(
          info.videoCodec || info.audioCodec
            ? { ...describeMedia(info), width: info.width, height: info.height }
            : null,
        );
      },
    );
  });
}
