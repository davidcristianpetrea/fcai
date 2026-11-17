import type { InputFace } from "./attention-state-machine";

export class FaceSimulator {
  public enabled = false;
  private activeFaceId = 1;
  private faces = new Map<number, { x: number; y: number; w: number; h: number; looking: boolean; crop_jpeg?: string }>();
  private indicator: HTMLElement | null = null;
  private listenersAttached = false;

  constructor() {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      this.enabled = params.get("sim") === "1" || params.get("simulator") === "1";
    }
  }

  public init(container: HTMLElement): void {
    if (!this.enabled || this.listenersAttached) return;
    this.listenersAttached = true;

    // Create synthetic face 1 at center-left
    this.createSyntheticFace(1, 0.35, 0.45, true);

    // Create simulator UI badge
    this.indicator = document.createElement("div");
    this.indicator.className = "simulator-badge";
    this.updateBadge();
    container.appendChild(this.indicator);

    window.addEventListener("mousemove", (e) => {
      if (!this.enabled) return;
      const x = Math.max(0.05, Math.min(0.95, e.clientX / window.innerWidth));
      const y = Math.max(0.05, Math.min(0.95, e.clientY / window.innerHeight));
      const current = this.faces.get(this.activeFaceId);
      if (current) {
        current.x = x - current.w / 2;
        current.y = y - current.h / 2;
      }
    });

    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (e.key === " " || e.key.toLowerCase() === "l") {
        e.preventDefault();
        const current = this.faces.get(this.activeFaceId);
        if (current) {
          current.looking = !current.looking;
          this.updateBadge();
        }
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const id = Number(e.key);
        this.activeFaceId = id;
        if (!this.faces.has(id)) {
          const x = 0.2 + (id - 1) * 0.18;
          this.createSyntheticFace(id, x, 0.45, true);
        }
        this.updateBadge();
      } else if (e.key.toLowerCase() === "c") {
        this.faces.clear();
        this.updateBadge();
      } else if (e.key.toLowerCase() === "a") {
        // Add face
        const nextId = this.faces.size + 1;
        if (nextId <= 4) {
          this.createSyntheticFace(nextId, 0.2 + (nextId - 1) * 0.18, 0.45, true);
          this.activeFaceId = nextId;
          this.updateBadge();
        }
      }
    });
  }

  private createSyntheticFace(id: number, x: number, y: number, looking: boolean): void {
    // Generate a nice synthetic portrait canvas as crop_jpeg
    let crop_jpeg: string | undefined;
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Background
        const grad = ctx.createLinearGradient(0, 0, 320, 320);
        grad.addColorStop(0, "#334155");
        grad.addColorStop(1, "#1e293b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 320);

        // Shoulders
        ctx.fillStyle = id % 2 === 0 ? "#0284c7" : "#059669";
        ctx.beginPath();
        ctx.ellipse(160, 330, 110, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head/Neck
        ctx.fillStyle = "#fbcfe8";
        ctx.fillRect(140, 200, 40, 60);

        ctx.fillStyle = id % 2 === 0 ? "#fed7aa" : "#fcd34d";
        ctx.beginPath();
        ctx.ellipse(160, 150, 65, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = id % 2 === 0 ? "#3b2f2f" : "#1e1e1e";
        ctx.beginPath();
        ctx.ellipse(160, 110, 70, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(140, 145, 6, 0, Math.PI * 2);
        ctx.arc(180, 145, 6, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = "#be123c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(160, 175, 20, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();

        crop_jpeg = canvas.toDataURL("image/jpeg", 0.85);
      }
    }

    this.faces.set(id, {
      x,
      y,
      w: 0.15,
      h: 0.22,
      looking,
      crop_jpeg,
    });
  }

  private updateBadge(): void {
    if (!this.indicator) return;
    const cur = this.faces.get(this.activeFaceId);
    const lookingStr = cur ? (cur.looking ? "👀 LOOKING (ACTIVE)" : "🙈 LOOKING AWAY") : "NO FACE";
    this.indicator.innerHTML = `
      <div style="font-family: monospace; font-size: 13px; background: rgba(15,23,42,0.92); color: #38bdf8; padding: 8px 12px; border-radius: 8px; border: 1px solid #0284c7; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div>🎮 <strong>SIMULATOR ACTIVE</strong> (Face #${this.activeFaceId} / Total: ${this.faces.size})</div>
        <div style="color: ${cur?.looking ? '#4ade80' : '#f87171'}; font-weight: bold; margin-top: 2px;">${lookingStr}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Move mouse = move face | Space/L = toggle look | 1-4 = select | A = add | C = clear</div>
      </div>
    `;
  }

  public getFaces(): InputFace[] {
    if (!this.enabled) return [];
    return Array.from(this.faces.entries()).map(([id, f]) => ({
      id,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      looking: f.looking,
      crop_jpeg: f.crop_jpeg,
      score: 0.95,
    }));
  }
}
