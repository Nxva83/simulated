import { BrowserWindow } from 'electron';
import type { ScanProgress, Source } from '@shared/library';
import { IPC } from '@shared/ipc';
import type { Library } from '../db';
import { scanSource } from './scanner';
import { Thumbnails } from './thumbnails';
import { SourceWatcher } from './watcher';

/**
 * Orchestration de l'indexation : file d'attente (une source à la fois), état de progression
 * consultable, diffusion des événements aux fenêtres, surveillance continue des sources.
 */
export class ScanManager {
  readonly thumbnails: Thumbnails;
  private readonly watcher: SourceWatcher;
  private readonly status = new Map<number, ScanProgress>();
  private queue: Source[] = [];
  private running = false;

  constructor(
    private readonly lib: Library,
    thumbsDir: string,
  ) {
    this.thumbnails = new Thumbnails(thumbsDir);
    this.watcher = new SourceWatcher(this.lib, this.thumbnails, (source, path, event) => {
      this.broadcast(IPC.libraryChanged, { sourceId: source.id, path, event });
    });
  }

  /** À l'ouverture : surveille toutes les sources et rattrape les changements survenus hors ligne. */
  start(): void {
    for (const source of this.lib.sources.list()) {
      this.watcher.watch(source);
      this.enqueue(source);
    }
  }

  async stop(): Promise<void> {
    this.queue = [];
    await this.watcher.close();
  }

  addSource(path: string, kind: Source['kind']): Source {
    const source = this.lib.sources.add(path, kind);
    this.watcher.watch(source);
    this.enqueue(source);
    return source;
  }

  removeSource(id: number): void {
    this.watcher.unwatch(id);
    this.queue = this.queue.filter((s) => s.id !== id);
    this.status.delete(id);
    this.lib.sources.remove(id);
    this.lib.music.prune();
    this.broadcast(IPC.libraryChanged, { sourceId: id, event: 'source-removed' });
  }

  rescan(sourceId?: number): void {
    const sources = this.lib.sources
      .list()
      .filter((s) => sourceId === undefined || s.id === sourceId);
    for (const s of sources) this.enqueue(s);
  }

  snapshot(): ScanProgress[] {
    return [...this.status.values()];
  }

  private enqueue(source: Source): void {
    if (this.queue.some((s) => s.id === source.id)) return;
    this.queue.push(source);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const source = this.queue.shift()!;
        await scanSource(this.lib, source, {
          thumbnails: this.thumbnails,
          onProgress: (p) => {
            this.status.set(source.id, p);
            this.broadcast(IPC.scanProgress, p);
            if (p.done)
              this.broadcast(IPC.libraryChanged, { sourceId: source.id, event: 'scan-done' });
          },
        });
      }
    } finally {
      this.running = false;
    }
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    }
  }
}
