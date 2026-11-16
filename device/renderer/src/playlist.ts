import type { MediaItem, Playlist } from "./types";

export class PlaylistEngine {
  private index = -1;
  private startedAt = 0;

  constructor(private readonly playlist: Playlist, private readonly clock: () => number = Date.now) {}

  start(): MediaItem | undefined {
    this.index = 0;
    this.startedAt = this.clock();
    return this.current();
  }

  current(): MediaItem | undefined {
    return this.playlist.items[this.index];
  }

  tick(): MediaItem | undefined {
    const item = this.current();
    if (!item || this.clock() - this.startedAt < item.durationMs) return item;
    this.index = (this.index + 1) % this.playlist.items.length;
    this.startedAt = this.clock();
    return this.current();
  }

  get transition() {
    return this.playlist.transition;
  }
}
