import { stat } from 'node:fs/promises';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Source } from '@shared/library';
import type { Library } from '../db';
import { indexFile } from './scanner';
import type { Thumbnails } from './thumbnails';
import { classify } from './walk';

/**
 * Surveille les dossiers sources : un fichier ajouté ou modifié est (ré)indexé, un fichier
 * supprimé est marqué manquant. Les événements sont regroupés (copie en cours, rafales).
 */
export class SourceWatcher {
  private watchers = new Map<number, FSWatcher>();
  private pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly lib: Library,
    private readonly thumbnails?: Thumbnails,
    private readonly onChange?: (
      source: Source,
      path: string,
      event: 'add' | 'change' | 'unlink',
    ) => void,
    private readonly debounceMs = 1500,
  ) {}

  watch(source: Source): void {
    this.unwatch(source.id);
    const w = chokidar.watch(source.path, {
      ignoreInitial: true,
      ignored: (p, stats) =>
        !!stats && stats.isDirectory() && /(^|[\\/])\./.test(p.slice(source.path.length)),
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
      persistent: true,
    });
    w.on('add', (p) => this.schedule(source, p, 'add'));
    w.on('change', (p) => this.schedule(source, p, 'change'));
    w.on('unlink', (p) => this.schedule(source, p, 'unlink'));
    w.on('error', (err) => console.error(`[watcher] ${source.path}: ${(err as Error).message}`));
    this.watchers.set(source.id, w);
  }

  unwatch(sourceId: number): void {
    const w = this.watchers.get(sourceId);
    if (w) {
      void w.close();
      this.watchers.delete(sourceId);
    }
  }

  async close(): Promise<void> {
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
    await Promise.all([...this.watchers.values()].map((w) => w.close()));
    this.watchers.clear();
  }

  private schedule(source: Source, path: string, event: 'add' | 'change' | 'unlink'): void {
    const prev = this.pending.get(path);
    if (prev) clearTimeout(prev);
    this.pending.set(
      path,
      setTimeout(() => {
        this.pending.delete(path);
        void this.handle(source, path, event);
      }, this.debounceMs),
    );
  }

  private async handle(
    source: Source,
    path: string,
    event: 'add' | 'change' | 'unlink',
  ): Promise<void> {
    try {
      if (event === 'unlink') {
        if (!this.lib.files.markMissingByPath(path)) return;
        this.lib.music.prune();
      } else {
        const kind = await classify(path);
        if (!kind) return;
        const st = await stat(path);
        await indexFile(
          this.lib,
          source,
          { path, kind, size: st.size, mtime: Math.floor(st.mtimeMs / 1000) },
          undefined,
          this.thumbnails,
        );
      }
      this.onChange?.(source, path, event);
    } catch (err) {
      console.error(`[watcher] ${path}: ${(err as Error).message}`);
    }
  }
}
