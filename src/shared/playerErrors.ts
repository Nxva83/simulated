import { extensionOf, isSupported } from './mediaFormats';

/** Codes de `HTMLMediaElement.error.code` (MediaError). */
export const MEDIA_ERR_ABORTED = 1;
export const MEDIA_ERR_NETWORK = 2;
export const MEDIA_ERR_DECODE = 3;
export const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/** Codecs courants que Chromium ne décode pas : on le dit explicitement à l'utilisateur. */
const KNOWN_UNSUPPORTED_HINT =
  'Chromium ne décode pas certains codecs (HEVC hors accélération matérielle, AC3, E-AC3, DTS, TrueHD).';

/**
 * Message en français destiné à l'utilisateur pour un code MediaError.
 * `detail` est le message technique optionnel du navigateur.
 */
export function messageForMediaError(code: number, detail?: string): string {
  let message: string;
  switch (code) {
    case MEDIA_ERR_ABORTED:
      message = 'Lecture interrompue.';
      break;
    case MEDIA_ERR_NETWORK:
      message = 'Erreur de lecture du fichier (réseau ou disque).';
      break;
    case MEDIA_ERR_DECODE:
      message = `Impossible de décoder ce fichier : il est corrompu ou son codec n'est pas pris en charge. ${KNOWN_UNSUPPORTED_HINT}`;
      break;
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      message = `Format ou codec non pris en charge par le décodeur. ${KNOWN_UNSUPPORTED_HINT}`;
      break;
    default:
      message = 'Erreur de lecture inconnue.';
  }
  return detail ? `${message} (${detail})` : message;
}

/**
 * Vérification préalable, sans passer par le décodeur.
 * Retourne un message d'erreur, ou `null` si le fichier peut être tenté.
 */
export function preflightError(path: string): string | null {
  if (!path) return 'Aucun fichier sélectionné.';
  if (isSupported(path)) return null;
  const ext = extensionOf(path);
  return ext
    ? `Le format « .${ext} » n'est pas pris en charge.`
    : "Ce fichier n'a pas d'extension reconnue.";
}
