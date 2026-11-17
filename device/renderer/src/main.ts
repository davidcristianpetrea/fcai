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
      dwellSeconds: config.lookTime || 2.5,
      offerMinSeconds: 8.0,
      exitAfterNobodySeconds: 4.0,
      maxOfferSeconds: 22.0,
      cooldownSeconds: 6.0,
      triggeringDurationMs: 1800,
      exitingDurationMs: 800,
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

    // Lock to people side whenever offer is active, allowing full-screen tracking only in standby
    const isOfferActive = phase === "TRIGGERING" || phase === "OFFER" || phase === "EXITING";

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
    const colors = getContrastColors(config.offerBackground);
    const bgColor = config.offerBackground || "#0f172a";

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.irisCtx) {
      this.irisCtx.clearRect(0, 0, w, h);
    }

    if (phase === "STANDBY" || phase === "COOLDOWN") {
      this.standbyContainer.style.filter = "none";
      this.standbyContainer.style.opacity = "1";
      this.offerContainer.style.display = "none";
      this.offerContainer.innerHTML = "";
      return;
    }

    this.offerContainer.style.display = "flex";

    const stateElapsed = nowMs - this.stateMachine.stateStartedMs;
    const triggerDuration = 1800; // ms for greeting then offer animation
    const exitDuration = 800;

    let slideAnim = 1.0;
    let greetingVisible = false;
    let greetingOpacity = 0.0;
    let greetingScale = 1.0;
    let greetingY = 0;
    let contentOpacity = 0.0;
    let contentScale = 1.0;
    let contentY = 0;

    if (phase === "TRIGGERING") {
      const slideP = Math.min(1.0, stateElapsed / 600);
      slideAnim = easeInOutCubic(slideP);

      if (stateElapsed < 1150) {
        greetingVisible = true;
        const bounceT = Math.min(1.0, stateElapsed / 600);
        // Premium elastic bounce curve: shoots to 1.14 then smoothly settles
        const overshoot = Math.sin(bounceT * Math.PI * 1.5) * 0.16 * (1 - bounceT);
        greetingScale = 0.6 + 0.4 * (bounceT + overshoot);
        if (stateElapsed > 800) {
          greetingOpacity = Math.max(0, 1.0 - (stateElapsed - 800) / 300);
          greetingY = -(1.0 - greetingOpacity) * 25;
        } else {
          greetingOpacity = Math.min(1.0, stateElapsed / 200);
          greetingY = 0;
        }
      }

      if (stateElapsed >= 950) {
        const contentT = Math.min(1.0, (stateElapsed - 950) / 700);
        const contentEased = easeInOutCubic(contentT);
        contentOpacity = contentEased;
        contentScale = 0.90 + 0.10 * contentEased;
        contentY = (1.0 - contentEased) * 20;
      }
    } else if (phase === "OFFER") {
      slideAnim = 1.0;
      greetingVisible = false;
      contentOpacity = 1.0;
      contentScale = 1.0;
      contentY = 0;
    } else if (phase === "EXITING") {
      const exitP = Math.min(1.0, stateElapsed / exitDuration);
      slideAnim = Math.max(0, 1.0 - easeInOutCubic(exitP));
      greetingVisible = false;
      contentOpacity = slideAnim;
      contentScale = 0.95 + 0.05 * slideAnim;
      contentY = 0;
    }

    // Soft blur & subtle dimming on the standby video side during the offer
    const blurPx = (7 * slideAnim).toFixed(1);
    const dimVal = (1.0 - 0.22 * slideAnim).toFixed(2);
    const opVal = (1.0 - 0.15 * slideAnim).toFixed(2);
    this.standbyContainer.style.filter = `blur(${blurPx}px) brightness(${dimVal})`;
    this.standbyContainer.style.opacity = opVal;

    // Content side opposite people; slides in from outer edge
    const contentSide = this.lockedPeopleSide === "left" ? "right" : "left";
    const slidePercent = (1.0 - slideAnim) * 100;
    const slideTransform =
      contentSide === "right"
        ? `translate3d(${slidePercent.toFixed(2)}%, 0, 0)`
        : `translate3d(-${slidePercent.toFixed(2)}%, 0, 0)`;

    // Smooth blur & color gradient blending the media half into the offer side
    const gradientBg =
      contentSide === "right"
        ? `linear-gradient(to right, transparent 0%, rgba(15, 23, 42, 0.40) 10%, rgba(15, 23, 42, 0.85) 24%, ${bgColor} 42%, ${bgColor} 100%)`
        : `linear-gradient(to left, transparent 0%, rgba(15, 23, 42, 0.40) 10%, rgba(15, 23, 42, 0.85) 24%, ${bgColor} 42%, ${bgColor} 100%)`;

    const greetingText = config.greetingText || "Hei!";
    const headline = config.headline || "20% reducere";
    const subtext = config.subtext || "Scanează codul QR cu telefonul";

    // Clean caption: filter out any placeholder text
    const rawCaption = (config.caption || "").trim();
    const isJunkCaption =
      rawCaption.toLowerCase().includes("poza cu m") ||
      rawCaption.toLowerCase().includes("aici poza") ||
      rawCaption.toLowerCase().includes("mancare");
    const caption = isJunkCaption ? "" : rawCaption;

    this.offerContainer.style.flexDirection = contentSide === "right" ? "row" : "row-reverse";
    this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="flex: 1; height: 100%; pointer-events: none;"></div>
      <div class="offer-half content-half" style="
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 5vw;
        background: ${gradientBg};
        transform: ${slideTransform};
        opacity: ${slideAnim.toFixed(2)};
        color: ${colors.text};
        will-change: transform, opacity;
        position: relative;
        overflow: hidden;
      ">
        ${
          greetingVisible
            ? `<div class="greeting-box" style="
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4vw;
                opacity: ${greetingOpacity.toFixed(2)};
                transform: translate3d(0, ${greetingY.toFixed(1)}px, 0) scale(${greetingScale.toFixed(3)});
                will-change: transform, opacity;
                pointer-events: none;
              ">
                <span class="greeting-text" style="
                  font-size: clamp(4.5rem, 9.5vw, 8rem);
                  font-weight: 900;
                  letter-spacing: -0.04em;
                  color: #38bdf8;
                  text-shadow: 0 10px 40px rgba(56, 189, 248, 0.45);
                  line-height: 1;
                ">${greetingText}</span>
              </div>`
            : ""
        }
        <div class="offer-card" style="
          background: transparent;
          max-width: 660px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          opacity: ${contentOpacity.toFixed(2)};
          transform: translate3d(0, ${contentY.toFixed(1)}px, 0) scale(${contentScale.toFixed(3)});
          will-change: transform, opacity;
        ">
          <h1 class="offer-headline" style="
            font-size: clamp(3rem, 6.2vw, 5.25rem);
            font-weight: 800;
            line-height: 1.08;
            letter-spacing: -0.03em;
            margin: 0;
            color: ${colors.text};
          ">${headline}</h1>
          <p class="offer-subtext" style="
            font-size: clamp(1.4rem, 2.6vw, 2.25rem);
            line-height: 1.35;
            margin: 0;
            font-weight: 500;
            color: ${colors.muted};
          ">${subtext}</p>
          <div class="qr-wrapper" style="margin-top: 0.5rem;">
            <div class="qr-card" style="
              background: #ffffff;
              padding: clamp(18px, 2.5vw, 30px);
              border-radius: clamp(20px, 3vw, 32px);
              box-shadow: 0 24px 50px rgba(0, 0, 0, 0.5);
              display: inline-flex;
            ">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image" style="width: 100%; height: auto; aspect-ratio: 1;">` : ""}
            </div>
            ${caption ? `<p class="qr-caption" style="color: ${colors.muted}; margin-top: 0.5rem;">${caption}</p>` : ""}
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
