import { AttentionStateMachine, type InputFace } from "./attention-state-machine";
import { FaceBlender } from "./face-blender";
import { buildQrUrl, generateQrDataUrl, getQrPixelSize } from "./qr";
import { clampFaceToPeopleSide, determineSides, separateFaces, type PeopleSide } from "./side-locking";
import { FaceSimulator } from "./simulator";
import {
  computeTransitionStyles,
  getTransitionDurationMs,
  TransitionSelector,
  type TransitionType,
} from "./transitions";

interface MediaItem {
  id: string;
  local: string;
  content_type: string;
  duration?: number;
}

interface DeviceConfig {
  template?: "recruit" | "simple";
  liveFaces?: boolean;
  lookTime?: number;
  standbyDuration?: number;
  standbyEnabled?: boolean;
  transition?: TransitionType;
  transitionSpeed?: number | "fast" | "normal" | "slow";
  offerLink?: string;
  headline?: string;
  subtext?: string;
  caption?: string;
  qrSize?: string | number;
  offerBackground?: string;
  playlist?: string[];
  offerMediaId?: string;
}

interface DeviceState {
  device_id?: string;
  sync?: {
    device_token?: string;
    display_name?: string;
    pairing?: { code?: string; expiresAt?: number };
    device_config?: DeviceConfig;
    media?: MediaItem[];
    playlist?: string[];
  };
}

function getContrastColors(hexColor: string | undefined): { text: string; muted: string } {
  let c = (hexColor || "#111827").replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  const r = parseInt(c.slice(0, 2), 16) || 17;
  const g = parseInt(c.slice(2, 4), 16) || 24;
  const b = parseInt(c.slice(4, 6), 16) || 39;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.55) {
    return { text: "#0f172a", muted: "#475569" };
  }
  return { text: "#f8fafc", muted: "#cbd5e1" };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutCubicOvershoot(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  // Subtle overshoot that settles smoothly
  const p = easeInOutCubic(t);
  const overshoot = Math.sin(t * Math.PI) * 0.08 * (1 - t);
  return p + overshoot;
}

export class App {
  private readonly root: HTMLElement;
  private readonly simulator = new FaceSimulator();
  private stateMachine = new AttentionStateMachine();
  private readonly blender = new FaceBlender(4);
  private readonly transitionSelector = new TransitionSelector();

  private state: DeviceState = {};
  private activeFaces: InputFace[] = [];
  private lockedPeopleSide: PeopleSide = "left";
  private qrDataUrl = "";
  private lastGeneratedQrUrl = "";

  // Standby playlist state
  private mediaList: MediaItem[] = [];
  private currentMediaIndex = 0;
  private currentItemStartedMs = 0;
  private isTransitioning = false;
  private transitionStartMs = 0;
  private activeTransitionType: any = "crossfade";
  private activeTransitionDuration = 900;
  private nextMediaPreloaded = false;

  // Canvas elements
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D | null;
  private irisCanvas: HTMLCanvasElement;
  private irisCtx: CanvasRenderingContext2D | null;

  // DOM containers
  private standbyContainer: HTMLElement;
  private offerContainer: HTMLElement;
  private setupContainer: HTMLElement;
  private debugOverlay: HTMLElement;

  private isDebugMode = false;
  private fps = 0;
  private frameCount = 0;
  private lastFpsTime = 0;

  private pendingConfig: DeviceConfig = {};
  private activeConfig: DeviceConfig = {};
  private pendingMediaList: MediaItem[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = "";

    const params = new URLSearchParams(window.location.search);
    this.isDebugMode = params.get("debug") === "1";

    // Create layered containers
    this.standbyContainer = document.createElement("div");
    this.standbyContainer.className = "layer standby-layer";
    this.root.appendChild(this.standbyContainer);

    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.className = "layer canvas-layer";
    this.root.appendChild(this.faceCanvas);
    this.faceCtx = this.faceCanvas.getContext("2d");

    this.irisCanvas = document.createElement("canvas");
    this.irisCanvas.className = "layer iris-layer";
    this.root.appendChild(this.irisCanvas);
    this.irisCtx = this.irisCanvas.getContext("2d");

    this.offerContainer = document.createElement("div");
    this.offerContainer.className = "layer offer-layer";
    this.root.appendChild(this.offerContainer);

    this.setupContainer = document.createElement("div");
    this.setupContainer.className = "layer setup-layer";
    this.root.appendChild(this.setupContainer);

    this.debugOverlay = document.createElement("div");
    this.debugOverlay.className = "debug-overlay";
    this.debugOverlay.style.display = this.isDebugMode ? "block" : "none";
    this.root.appendChild(this.debugOverlay);

    this.simulator.init(this.root);
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.connectVision();
    this.pollState();
    setInterval(() => this.pollState(), 2500);

    requestAnimationFrame((ts) => this.renderLoop(ts));
  }

  private resizeCanvas(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.faceCanvas.width = w;
    this.faceCanvas.height = h;
    this.irisCanvas.width = w;
    this.irisCanvas.height = h;
  }

  private connectVision(): void {
    const wsUrl = `ws://${location.hostname || "127.0.0.1"}:8766`;
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.t === "faces" && Array.isArray(data.faces)) {
            if (!this.simulator.enabled) {
              this.activeFaces = data.faces;
            }
          }
        } catch {}
      };
      ws.onclose = () => setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
    };
    connect();
  }

  private async pollState(): Promise<void> {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as DeviceState;
        this.updateState(next);
      }
    } catch {}
  }

  private updateState(next: DeviceState): void {
    this.state = next;
    const config = this.state.sync?.device_config || {};
    this.pendingConfig = config;
    if (!this.currentItemStartedMs) {
      this.activeConfig = { ...config };
    }

    // Update state machine configuration without destroying current tracking state
    this.stateMachine.updateConfig({
      dwellSeconds: config.lookTime || 3.0,
      offerMinSeconds: 20.0,
      exitAfterNobodySeconds: 6.0,
      cooldownSeconds: 8.0,
    });

    // Update media playlist
    const allMedia = this.state.sync?.media || [];
    const playlistIds = this.state.sync?.playlist || [];
    if (playlistIds.length > 0) {
      this.pendingMediaList = playlistIds
        .map((id) => allMedia.find((m) => m.id === id))
        .filter(Boolean) as MediaItem[];
    } else {
      this.pendingMediaList = allMedia;
    }
    if (!this.currentItemStartedMs) {
      this.mediaList = this.pendingMediaList;
    }

    // Update QR code if link changed
    const deviceId = this.state.sync?.pairing?.code ? "display" : (this.state.device_id || "");
    const qrUrl = buildQrUrl(config.offerLink, deviceId);
    if (qrUrl !== this.lastGeneratedQrUrl) {
      this.lastGeneratedQrUrl = qrUrl;
      const pixelSize = getQrPixelSize(config.qrSize, window.innerWidth, window.innerHeight);
      generateQrDataUrl(qrUrl, pixelSize).then((dataUrl) => {
        this.qrDataUrl = dataUrl;
      });
    }
  }

  private preloadNextMedia(): void {
    if (this.mediaList.length <= 1) return;
    const nextIdx = (this.currentMediaIndex + 1) % this.mediaList.length;
    const nextItem = this.mediaList[nextIdx];
    if (!nextItem) return;
    if (nextItem.content_type?.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "auto";
      v.src = nextItem.local;
    } else {
      const img = new Image();
      img.src = nextItem.local;
    }
  }

  private renderLoop(nowMs: number): void {
    this.frameCount++;
    if (nowMs - this.lastFpsTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (nowMs - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = nowMs;
    }

    const paired = Boolean(this.state.sync?.device_token);

    if (!paired) {
      this.renderSetup();
      this.standbyContainer.style.display = "none";
      this.offerContainer.style.display = "none";
      this.faceCanvas.style.display = "none";
      this.irisCanvas.style.display = "none";
    } else {
      this.setupContainer.style.display = "none";
      this.standbyContainer.style.display = "block";
      this.faceCanvas.style.display = "block";
      this.irisCanvas.style.display = "block";
      this.offerContainer.style.display = "block";

      const faces = this.simulator.enabled ? this.simulator.getFaces() : this.activeFaces;
      const prevPhase = this.stateMachine.state;
      const phase = this.stateMachine.update(faces, nowMs);

      // Lock people side at trigger time
      if (prevPhase === "STANDBY" && phase === "TRIGGERING") {
        const sides = determineSides(faces);
        this.lockedPeopleSide = sides.peopleSide;
      }

      this.renderMedia(nowMs);
      this.renderFaceBlending(faces, nowMs, phase);
      this.renderTemplate(phase, nowMs);
    }

    if (this.isDebugMode) {
      this.renderDebug(nowMs);
    }

    requestAnimationFrame((ts) => this.renderLoop(ts));
  }

  private renderSetup(): void {
    this.setupContainer.style.display = "flex";
    const pairing = this.state.sync?.pairing;
    const rawCode = String(pairing?.code || "");
    const formatted = rawCode.length === 6 ? `${rawCode.slice(0, 3)} ${rawCode.slice(3)}` : rawCode;
    const english = new URLSearchParams(window.location.search).get("lang") === "en";

    this.setupContainer.innerHTML = `
      <div class="setup-card">
        <div class="brand-badge">AdSense Smart Display</div>
        <h1>${english ? "Connect this display" : "Conectează acest ecran"}</h1>
        <p class="setup-instruction">${
          english
            ? "Go to <strong>adsense.davidpetrea.ro</strong> → <em>Add display</em> and enter this code:"
            : "Mergi pe <strong>adsense.davidpetrea.ro</strong> → <em>Adaugă ecran</em> și introdu codul:"
        }</p>
        <div class="pairing-code">${formatted || "••• •••"}</div>
        <p class="setup-footer">${
          english ? "Waiting for connection…" : "Se așteaptă conectarea…"
        }</p>
      </div>
    `;
  }

  private renderMedia(nowMs: number): void {
    if (this.mediaList.length === 0) {
      if (this.standbyContainer.dataset.loaded !== "brand") {
        this.standbyContainer.dataset.loaded = "brand";
        this.standbyContainer.innerHTML = `
          <div class="standby-brand">
            <h1>${this.state.sync?.display_name || "AdSense"}</h1>
            <p>Smart Display</p>
          </div>
        `;
      }
      return;
    }

    const config = this.state.sync?.device_config || {};
    const itemDuration = (config.standbyDuration || 8) * 1000;

    if (!this.currentItemStartedMs) {
      this.currentItemStartedMs = nowMs;
      this.renderActiveMediaSlot();
    }

    const elapsed = nowMs - this.currentItemStartedMs;
    const activeSlot = this.standbyContainer.querySelector<HTMLElement>(".media-slot.active");
    const activeVideo = activeSlot?.querySelector("video");
    const videoEnded = Boolean(
      activeVideo &&
        (activeVideo.ended ||
          (activeVideo.duration > 0 && activeVideo.currentTime >= activeVideo.duration - 0.2))
    );
    const durationPassed = elapsed >= itemDuration;

    // Check if item duration expired or video ended -> advance playlist and animate transition
    if ((durationPassed || videoEnded) && !this.isTransitioning && this.mediaList.length >= 1) {
      this.isTransitioning = true;
      this.transitionStartMs = nowMs;
      this.activeTransitionType = this.transitionSelector.resolve(config.transition);
      this.activeTransitionDuration = getTransitionDurationMs(config.transitionSpeed);
      this.prepareNextMediaSlot();
    }

    // Process transition animation if active
    if (this.isTransitioning) {
      const transElapsed = nowMs - this.transitionStartMs;
      const progress = Math.min(1.0, transElapsed / this.activeTransitionDuration);
      const styles = computeTransitionStyles(this.activeTransitionType, progress);

      const outgoing = this.standbyContainer.querySelector<HTMLElement>(".media-slot.outgoing");
      const incoming = this.standbyContainer.querySelector<HTMLElement>(".media-slot.incoming");

      if (outgoing) {
        outgoing.style.opacity = String(styles.outgoing.opacity);
        outgoing.style.transform = styles.outgoing.transform;
        if (styles.outgoing.filter) outgoing.style.filter = styles.outgoing.filter;
      }
      if (incoming) {
        incoming.style.opacity = String(styles.incoming.opacity);
        incoming.style.transform = styles.incoming.transform;
        if (styles.incoming.filter) incoming.style.filter = styles.incoming.filter;
        if (styles.incoming.maskImage) {
          incoming.style.webkitMaskImage = styles.incoming.maskImage;
          (incoming.style as any).maskImage = styles.incoming.maskImage;
        } else {
          incoming.style.webkitMaskImage = "none";
          (incoming.style as any).maskImage = "none";
        }
      }

      if (progress >= 1.0) {
        this.isTransitioning = false;
        this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaList.length;
        this.currentItemStartedMs = nowMs;
        this.finalizeMediaTransition();
      }
    } else {
      // Ken Burns effect on photos during active display
      const currentActiveSlot = this.standbyContainer.querySelector<HTMLElement>(".media-slot.active");
      if (currentActiveSlot && currentActiveSlot.dataset.type === "image") {
        const p = Math.min(1.0, elapsed / itemDuration);
        const scale = 1.0 + 0.08 * p;
        const panX = -1.5 + 3.0 * p;
        const panY = -0.75 + 1.5 * p;
        currentActiveSlot.style.transform = `translate3d(${panX.toFixed(2)}%, ${panY.toFixed(2)}%, 0) scale(${scale.toFixed(4)})`;
      }
    }
  }

  private renderActiveMediaSlot(): void {
    const item = this.mediaList[this.currentMediaIndex % this.mediaList.length];
    if (!item) return;
    const isVideo = item.content_type?.startsWith("video/");
    this.standbyContainer.innerHTML = `
      <div class="media-slot active" data-type="${isVideo ? "video" : "image"}" style="opacity: 1; transform: none;">
        ${
          isVideo
            ? `<video src="${item.local}" autoplay muted playsinline></video>`
            : `<img src="${item.local}" alt="">`
        }
      </div>
    `;
  }

  private prepareNextMediaSlot(): void {
    this.standbyContainer.querySelectorAll(".media-slot.incoming").forEach((el) => el.remove());

    const nextIdx = (this.currentMediaIndex + 1) % this.mediaList.length;
    const nextItem = this.mediaList[nextIdx];
    if (!nextItem) return;
    const isVideo = nextItem.content_type?.startsWith("video/");

    const currentSlot = this.standbyContainer.querySelector<HTMLElement>(".media-slot.active");
    if (currentSlot) {
      currentSlot.className = "media-slot outgoing";
    }

    const nextSlot = document.createElement("div");
    nextSlot.className = "media-slot incoming";
    nextSlot.dataset.type = isVideo ? "video" : "image";
    nextSlot.style.opacity = "0";

    if (isVideo) {
      const v = document.createElement("video");
      v.src = nextItem.local;
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.currentTime = 0;
      v.play().catch(() => {});
      nextSlot.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = nextItem.local;
      img.alt = "";
      nextSlot.appendChild(img);
    }

    this.standbyContainer.appendChild(nextSlot);
  }

  private finalizeMediaTransition(): void {
    const outgoings = this.standbyContainer.querySelectorAll<HTMLElement>(".media-slot.outgoing");
    outgoings.forEach((el) => el.remove());
    const incoming = this.standbyContainer.querySelector<HTMLElement>(".media-slot.incoming");
    if (incoming) {
      incoming.className = "media-slot active";
      incoming.style.opacity = "1";
      incoming.style.transform = "none";
      incoming.style.filter = "none";
      incoming.style.webkitMaskImage = "none";
      (incoming.style as any).maskImage = "none";
    }
    // Apply new configuration at next item boundary
    this.activeConfig = { ...this.pendingConfig };
    this.mediaList = this.pendingMediaList.length > 0 ? this.pendingMediaList : this.mediaList;
    this.preloadNextMedia();
  }

  private renderFaceBlending(faces: InputFace[], nowMs: number, phase: string): void {
    if (!this.faceCtx) return;
    const w = this.faceCanvas.width;
    const h = this.faceCanvas.height;
    this.faceCtx.clearRect(0, 0, w, h);

    const config = this.state.sync?.device_config || {};
    if (config.liveFaces === false) return;

    // Filter and update face tracks
    this.blender.update(faces, nowMs, w, h);
    const tracks = this.blender.getActiveTracks();
    if (tracks.length === 0) return;

    // Only lock to people side when offer/iris is active, allowing full-screen tracking in standby
    const isOfferActive =
      (phase === "TRIGGERING" || phase === "OFFER" || phase === "EXITING") &&
      (config.template || "recruit") === "recruit";

    const items = tracks.map((t) => ({
      id: t.id,
      cx: t.currentX,
      cy: t.currentY,
      radius: t.currentSize / 2,
    }));

    const separated = separateFaces(items, this.lockedPeopleSide, w, h, isOfferActive);
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].currentX = separated[i].cx;
      tracks[i].currentY = separated[i].cy;
    }

    this.blender.render(this.faceCtx, w, h);
  }

  private renderTemplate(phase: string, nowMs: number): void {
    const config = this.state.sync?.device_config || {};
    const template = config.template || "simple";
    const colors = getContrastColors(config.offerBackground);
    const bgColor = config.offerBackground || "#111827";

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (!this.irisCtx) return;
    this.irisCtx.clearRect(0, 0, w, h);

    if (phase === "STANDBY" || phase === "COOLDOWN") {
      this.offerContainer.style.display = "none";
      this.offerContainer.innerHTML = "";
      return;
    }

    this.offerContainer.style.display = "flex";

    let irisProgress = 1.0;
    let contentOpacity = 1.0;
    let qrScale = 1.0;

    const stateElapsed = nowMs - this.stateMachine.stateStartedMs;

    if (phase === "TRIGGERING") {
      const triggerDuration = 1000;
      irisProgress = Math.min(1.0, stateElapsed / triggerDuration);
      contentOpacity = Math.max(0, (stateElapsed - 600) / 400);
      qrScale = 0.92 + 0.08 * contentOpacity;
    } else if (phase === "OFFER") {
      irisProgress = 1.0;
      contentOpacity = 1.0;
      qrScale = 1.0;
    } else if (phase === "EXITING") {
      const exitDuration = 1000;
      const exitProgress = Math.min(1.0, stateElapsed / exitDuration);
      contentOpacity = Math.max(0, 1.0 - exitProgress * 2.5);
      qrScale = 0.92 + 0.08 * contentOpacity;
      irisProgress = Math.max(0, 1.0 - exitProgress);
    }

    if (template === "recruit") {
      // Looney tunes iris animation: background closes in around each face blend
      const easeP = easeInOutCubicOvershoot(irisProgress);
      const maxRadius = Math.hypot(w, h);
      const activeTracks = this.blender.getActiveTracks();

      this.irisCtx.save();
      this.irisCtx.fillStyle = bgColor;
      this.irisCtx.fillRect(0, 0, w, h);

      // Cut out holes centered on each face blend
      this.irisCtx.globalCompositeOperation = "destination-out";
      if (activeTracks.length > 0) {
        for (const track of activeTracks) {
          const targetRadius = (track.currentSize / 2) * 1.15;
          const currentRadius = maxRadius + (targetRadius - maxRadius) * easeP;
          this.irisCtx.beginPath();
          this.irisCtx.arc(track.currentX, track.currentY, currentRadius, 0, Math.PI * 2);
          this.irisCtx.fill();
        }
      } else {
        const currentRadius = maxRadius * (1 - easeP);
        this.irisCtx.beginPath();
        this.irisCtx.arc(w / 4, h / 2, currentRadius, 0, Math.PI * 2);
        this.irisCtx.fill();
      }
      this.irisCtx.restore();
    } else {
      // Simple template: soft fade in background
      this.irisCtx.save();
      this.irisCtx.globalAlpha = irisProgress;
      this.irisCtx.fillStyle = bgColor;
      this.irisCtx.fillRect(0, 0, w, h);
      this.irisCtx.restore();
    }

    // Render 50/50 offer layout
    const contentSide = this.lockedPeopleSide === "left" ? "right" : "left";
    const slideOffset = template === "simple" ? (1.0 - contentOpacity) * (contentSide === "right" ? 40 : -40) : 0;

    const headline = config.headline || "20% reducere";
    const subtext = config.subtext || "Scanează codul QR cu telefonul";
    const caption = config.caption || "";

    this.offerContainer.style.flexDirection = contentSide === "right" ? "row" : "row-reverse";
    this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="opacity: ${contentOpacity}"></div>
      <div class="offer-half content-half" style="
        opacity: ${contentOpacity};
        transform: translate3d(${slideOffset}px, 0, 0);
        color: ${colors.text};
      ">
        <div class="offer-card" style="background: transparent;">
          <h1 class="offer-headline" style="color: ${colors.text};">${headline}</h1>
          <p class="offer-subtext" style="color: ${colors.muted};">${subtext}</p>
          <div class="qr-wrapper" style="transform: scale(${qrScale.toFixed(4)});">
            <div class="qr-card">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image">` : ""}
            </div>
            ${caption ? `<p class="qr-caption" style="color: ${colors.muted};">${caption}</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  private renderDebug(nowMs: number): void {
    const elapsedDwell = this.stateMachine.state === "STANDBY" && this.activeFaces[0]?.looking
      ? ((nowMs - (this.stateMachine as any).tracks?.get(this.activeFaces[0].id)?.lookingSinceMs || 0) / 1000).toFixed(1)
      : "0.0";

    this.debugOverlay.innerHTML = `
      <div><strong>AdSense Debug HUD</strong></div>
      <div>FPS: ${this.fps}</div>
      <div>State: ${this.stateMachine.state} (phase: ${this.stateMachine.effectivePhase})</div>
      <div>People Side: ${this.lockedPeopleSide}</div>
      <div>Faces: ${this.activeFaces.length}</div>
      <div>Dwell: ${elapsedDwell}s</div>
      <div>Cooldown: ${this.stateMachine.isCooldownActive ? "ACTIVE" : "none"}</div>
    `;
  }
}

// Bootstrap
if (typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector<HTMLElement>("#app");
    if (root) new App(root);
  });
}
