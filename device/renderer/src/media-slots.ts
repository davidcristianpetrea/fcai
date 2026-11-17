import type { MediaItem } from "./types";

export interface MediaSlot {
  readonly element: HTMLElement;
  set(item: MediaItem): void;
  clear(): void;
}

export function createMediaSlot(element: HTMLElement): MediaSlot {
  return {
    element,
    set(item) {
      element.replaceChildren();
      if (item.kind === "image") {
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.alt ?? "";
        image.decoding = "async";
        element.append(image);
      } else if (item.kind === "video") {
        const video = document.createElement("video");
        video.src = item.src;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        element.append(video);
      } else {
        const frame = document.createElement("iframe");
        frame.src = item.src;
        frame.title = item.alt ?? "content";
        frame.referrerPolicy = "no-referrer";
        element.append(frame);
      }
    },
    clear() {
      element.replaceChildren();
    },
  };
}
