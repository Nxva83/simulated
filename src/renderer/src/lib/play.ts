export interface PlayRequest {
  path: string;
  fromStart?: boolean;
  /** Incrémenté à chaque demande pour rejouer le même fichier. */
  seq: number;
}
