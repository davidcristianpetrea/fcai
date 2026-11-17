export type TransitionType =
  | "crossfade"
  | "zoom dissolve"
  | "zoom_dissolve"
  | "push"
  | "soft wipe"
  | "soft_wipe"
  | "dip to black"
  | "dip_to_black"
  | "auto";

export type TransitionSpeed = "fast" | "normal" | "slow" | number;

export interface TransitionConfig {
  type: TransitionType;
  speed: TransitionSpeed;
}

export const TRANSITION_TYPES: Exclude<TransitionType, "auto">[] = [
  "crossfade",
  "zoom dissolve",
  "push",
  "soft wipe",
  "dip to black",
];

export function getTransitionDurationMs(speed: TransitionSpeed | undefined): number {
  if (typeof speed === "number") {
    if (speed <= 0.6) return 500;
    if (speed >= 1.2) return 1400;
    return 900;
  }
  switch (speed) {
    case "fast":
      return 500;
    case "slow":
      return 1400;
    case "normal":
    default:
      return 900;
  }
}

export class TransitionSelector {
  private lastType: Exclude<TransitionType, "auto"> | null = null;

  public resolve(configured: TransitionType | undefined): Exclude<TransitionType, "auto"> {
    let normalized = (configured || "crossfade").toLowerCase().replace(/_/g, " ") as TransitionType;

    if (normalized === "auto") {
      const candidates = TRANSITION_TYPES.filter((t) => t !== this.lastType);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || "crossfade";
      this.lastType = chosen;
      return chosen;
    }

    if (!TRANSITION_TYPES.includes(normalized as any)) {
      normalized = "crossfade";
    }

    const resolved = normalized as Exclude<TransitionType, "auto">;
    this.lastType = resolved;
    return resolved;
  }
}

export interface TransitionStyles {
  outgoing: {
    opacity: number;
    transform: string;
    filter?: string;
    maskImage?: string;
  };
  incoming: {
    opacity: number;
    transform: string;
    filter?: string;
    maskImage?: string;
  };
}

export function easeInOutSine(x: number): number {
  const val = -(Math.cos(Math.PI * x) - 1) / 2;
  return val === 0 ? 0 : val;
}

export function computeTransitionStyles(
  type: Exclude<TransitionType, "auto">,
  progress: number, // 0..1
): TransitionStyles {
  const p = Math.max(0, Math.min(1, progress));
  const eased = easeInOutSine(p);

  switch (type) {
    case "crossfade": {
      return {
        outgoing: {
          opacity: 1 - eased,
          transform: "none",
        },
        incoming: {
          opacity: eased,
          transform: "none",
        },
      };
    }

    case "zoom dissolve": {
      // outgoing scales 1 -> 1.06 and fades out; incoming scales 1.04 -> 1 and fades in
      const outScale = 1.0 + 0.06 * eased;
      const inScale = 1.04 - 0.04 * eased;
      return {
        outgoing: {
          opacity: 1 - eased,
          transform: `scale(${outScale.toFixed(4)})`,
        },
        incoming: {
          opacity: eased,
          transform: `scale(${inScale.toFixed(4)})`,
        },
      };
    }

    case "push": {
      // incoming moves 100% -> 0, outgoing moves 0 -> -30% and dims to 0.6
      const inX = (1 - eased) * 100;
      const outX = -eased * 30;
      const dim = 1 - 0.4 * eased;
      return {
        outgoing: {
          opacity: 1,
          transform: `translate3d(${outX.toFixed(2)}%, 0, 0)`,
          filter: `brightness(${dim.toFixed(3)})`,
        },
        incoming: {
          opacity: 1,
          transform: `translate3d(${inX.toFixed(2)}%, 0, 0)`,
        },
      };
    }

    case "soft wipe": {
      // a 15% feathered edge from right to left
      const stop = p * 115;
      const start = Math.max(0, stop - 15);
      const mask = `linear-gradient(to right, #000 0%, #000 ${start.toFixed(1)}%, transparent ${stop.toFixed(1)}%)`;
      return {
        outgoing: {
          opacity: 1,
          transform: "none",
        },
        incoming: {
          opacity: 1,
          transform: "none",
          maskImage: mask,
        },
      };
    }

    case "dip to black": {
      // Outgoing fades to black in first half (0..0.5), incoming fades from black in second half (0.5..1)
      if (p < 0.5) {
        const halfP = p * 2;
        return {
          outgoing: {
            opacity: 1 - halfP,
            transform: "none",
          },
          incoming: {
            opacity: 0,
            transform: "none",
          },
        };
      } else {
        const halfP = (p - 0.5) * 2;
        return {
          outgoing: {
            opacity: 0,
            transform: "none",
          },
          incoming: {
            opacity: halfP,
            transform: "none",
          },
        };
      }
    }
  }
}
