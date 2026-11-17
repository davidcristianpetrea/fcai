import { OneEuroFilter } from "./one-euro-filter";

export interface FaceInput {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  crop_jpeg?: string;
  looking?: boolean;
}

export interface FaceTrackState {
  id: number;
  filterX: OneEuroFilter;
  filterY: OneEuroFilter;
  filterSize: OneEuroFilter;
  currentX: number;
  currentY: number;
  currentSize: number;
  firstSeenMs: number;
  lastSeenMs: number;
  alpha: number;
  scale: number;
  image?: HTMLImageElement;
  cropJpeg?: string;
}

export interface BlenderOptions {
  screenWidth: number;
  screenHeight: number;
  maxPeople?: number;
}

export class FaceBlender {
  private readonly tracks = new Map<number, FaceTrackState>();
  private readonly maxPeople: number;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor(maxPeople = 4) {
    this.maxPeople = maxPeople;
  }

  public getTrack(id: number): FaceTrackState | undefined {
    return this.tracks.get(id);
  }

  public getActiveTracks(): FaceTrackState[] {
    return Array.from(this.tracks.values()).filter((t) => t.alpha > 0);
  }

  public update(faces: FaceInput[], nowMs: number, width: number, height: number): FaceTrackState[] {
    const presentIds = new Set<number>();
    const sorted = faces.slice(0, this.maxPeople);

    const minSize = height * 0.18;
    const maxSize = height * 0.40;

    for (const face of sorted) {
      presentIds.add(face.id);
      const rawCx = (face.x + face.w / 2.0) * width;
      const rawCy = (face.y + face.h / 2.0 + 0.15 * face.h) * height;
      const rawSize = Math.max(minSize, Math.min(maxSize, 2.4 * face.h * height));

      let track = this.tracks.get(face.id);
      if (!track) {
        track = {
          id: face.id,
          filterX: new OneEuroFilter(1.0, 0.007),
          filterY: new OneEuroFilter(1.0, 0.007),
          filterSize: new OneEuroFilter(1.0, 0.007),
          currentX: rawCx,
          currentY: rawCy,
          currentSize: rawSize,
          firstSeenMs: nowMs,
          lastSeenMs: nowMs,
          alpha: 0.0,
          scale: 0.85,
          cropJpeg: face.crop_jpeg,
        };
        track.filterX.filter(rawCx, nowMs);
        track.filterY.filter(rawCy, nowMs);
        track.filterSize.filter(rawSize, nowMs);

        if (typeof Image !== "undefined" && face.crop_jpeg) {
          const img = new Image();
          img.src = face.crop_jpeg;
          track.image = img;
        }
        this.tracks.set(face.id, track);
      } else {
        track.lastSeenMs = nowMs;
        track.currentX = track.filterX.filter(rawCx, nowMs);
        track.currentY = track.filterY.filter(rawCy, nowMs);
        track.currentSize = track.filterSize.filter(rawSize, nowMs);

        if (face.crop_jpeg && face.crop_jpeg !== track.cropJpeg) {
          track.cropJpeg = face.crop_jpeg;
          if (track.image) {
            track.image.src = face.crop_jpeg;
          } else if (typeof Image !== "undefined") {
            const img = new Image();
            img.src = face.crop_jpeg;
            track.image = img;
          }
        }
      }

      // Fade/scale in over 250ms
      const inProgress = Math.min(1.0, Math.max(0.0, (nowMs - track.firstSeenMs) / 250.0));
      track.alpha = inProgress;
      track.scale = 0.85 + 0.15 * inProgress;
    }

    // Process tracks not present in current message
    for (const [id, track] of this.tracks.entries()) {
      if (!presentIds.has(id)) {
        const elapsedSinceLost = nowMs - track.lastSeenMs;
        if (elapsedSinceLost <= 600) {
          // Hold 600 ms after the face is lost
          track.alpha = 1.0;
          track.scale = 1.0;
        } else if (elapsedSinceLost <= 900) {
          // Fade out over 300 ms (elapsed 600 -> 900)
          const outProgress = (elapsedSinceLost - 600) / 300.0;
          track.alpha = Math.max(0.0, 1.0 - outProgress);
          track.scale = Math.max(0.85, 1.0 - 0.15 * outProgress);
        } else {
          // Completely dead
          this.tracks.delete(id);
        }
      }
    }

    return this.getActiveTracks();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (typeof document === "undefined") return;

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }
    if (!this.offscreenCtx || !this.offscreenCanvas) return;

    for (const track of this.getActiveTracks()) {
      const img = track.image;
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      const renderSize = Math.round(track.currentSize * track.scale);
      if (renderSize <= 0) continue;

      if (this.offscreenCanvas.width !== renderSize || this.offscreenCanvas.height !== renderSize) {
        this.offscreenCanvas.width = renderSize;
        this.offscreenCanvas.height = renderSize;
      }

      const oCtx = this.offscreenCtx;
      oCtx.clearRect(0, 0, renderSize, renderSize);

      // 1. Draw live camera image
      oCtx.globalCompositeOperation = "source-over";
      oCtx.drawImage(img, 0, 0, renderSize, renderSize);

      // 2. Feathered ellipse mask using radial gradient and destination-in
      oCtx.globalCompositeOperation = "destination-in";
      const radius = renderSize / 2;
      const grad = oCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);

      // Alpha 1.0 at center, falling smoothly to 0 at 100% with wide feathered smoothstep curve
      grad.addColorStop(0.0, "rgba(0,0,0,1)");
      grad.addColorStop(0.20, "rgba(0,0,0,0.98)");
      grad.addColorStop(0.35, "rgba(0,0,0,0.88)");
      grad.addColorStop(0.50, "rgba(0,0,0,0.70)");
      grad.addColorStop(0.65, "rgba(0,0,0,0.48)");
      grad.addColorStop(0.80, "rgba(0,0,0,0.24)");
      grad.addColorStop(0.92, "rgba(0,0,0,0.07)");
      grad.addColorStop(1.0, "rgba(0,0,0,0)");

      oCtx.fillStyle = grad;
      oCtx.fillRect(0, 0, renderSize, renderSize);

      // 3. Composite onto target canvas
      ctx.save();
      ctx.globalAlpha = track.alpha;
      ctx.drawImage(
        this.offscreenCanvas,
        Math.round(track.currentX - renderSize / 2),
        Math.round(track.currentY - renderSize / 2),
        renderSize,
        renderSize
      );
      ctx.restore();
    }
  }
}
