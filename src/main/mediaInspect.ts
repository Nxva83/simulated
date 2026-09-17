import { parseFile } from 'music-metadata';

// Valeurs de TrackType (Matroska) : 1 = vidéo, 2 = audio. L'enum n'est pas ré-exporté par le paquet.
const TRACK_VIDEO = 1;
const TRACK_AUDIO = 2;
import { type MediaInfo, warningForMediaInfo } from '@shared/codecs';

/** Lit les en-têtes du conteneur (sans décoder) pour connaître les codecs présents. */
export async function inspectMedia(filePath: string): Promise<MediaInfo> {
  try {
    const { format } = await parseFile(filePath, { duration: false, skipCovers: true });
    const tracks = format.trackInfo ?? [];
    const audio = tracks.find((t) => t.type === TRACK_AUDIO);
    const video = tracks.find((t) => t.type === TRACK_VIDEO);
    const info = {
      container: format.container,
      audioCodec: audio?.codecName ?? format.codec,
      videoCodec: video?.codecName,
    };
    return { ...info, warning: warningForMediaInfo(info) };
  } catch {
    // Conteneur inconnu ou corrompu : on laisse <video> produire le diagnostic.
    return { warning: null };
  }
}
