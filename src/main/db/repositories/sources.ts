import type { DatabaseSync } from 'node:sqlite';
import type { Source, SourceKind } from '@shared/library';

interface Row {
  id: number;
  path: string;
  kind: SourceKind;
  added_at: number;
  last_scan_at: number | null;
}

const toSource = (r: Row): Source => ({
  id: r.id,
  path: r.path,
  kind: r.kind,
  addedAt: r.added_at,
  lastScanAt: r.last_scan_at,
});

/** Dossiers à indexer (issue #4). */
export class SourcesRepository {
  constructor(private readonly db: DatabaseSync) {}

  list(): Source[] {
    return (
      this.db.prepare('SELECT * FROM sources ORDER BY added_at').all() as unknown as Row[]
    ).map(toSource);
  }

  add(path: string, kind: SourceKind): Source {
    this.db
      .prepare(
        'INSERT INTO sources (path, kind) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET kind = excluded.kind',
      )
      .run(path, kind);
    return toSource(
      this.db.prepare('SELECT * FROM sources WHERE path = ?').get(path) as unknown as Row,
    );
  }

  /** Supprime la source et, par cascade, ses fichiers indexés. */
  remove(id: number): void {
    this.db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    this.db.exec(
      "DELETE FROM search_index WHERE item_type = 'file' AND item_id NOT IN (SELECT id FROM media_files)",
    );
  }

  touchScanned(id: number): void {
    this.db.prepare('UPDATE sources SET last_scan_at = unixepoch() WHERE id = ?').run(id);
  }
}
