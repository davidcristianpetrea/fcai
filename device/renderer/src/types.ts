export type MediaKind = "image" | "video" | "html";

export interface MediaItem {
  id: string;
  src: string;
  kind: MediaKind;
  durationMs: number;
  alt?: string;
  kenBurns?: KenBurnsConfig;
}

export interface KenBurnsConfig {
  fromScale: number;
  toScale: number;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

export type TransitionName = "cut" | "fade" | "crossfade" | "slide";

export interface Playlist {
  items: MediaItem[];
  transition: TransitionName;
}

export interface RendererClock {
  now(): number;
}
