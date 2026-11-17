export type AttentionState = "STANDBY" | "TRIGGERING" | "OFFER" | "EXITING" | "COOLDOWN";

export interface AttentionStateMachineConfig {
  dwellSeconds?: number;
  offerMinSeconds?: number;
  exitAfterNobodySeconds?: number;
  cooldownSeconds?: number;
  lookingResetSeconds?: number;
  triggeringDurationMs?: number;
  exitingDurationMs?: number;
  absentToRetriggerSeconds?: number;
}

export interface InputFace {
  id: number;
  looking?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  score?: number;
  crop_jpeg?: string;
}

interface InternalTrack {
  id: number;
  firstSeenMs: number;
  lastSeenMs: number;
  isLooking: boolean;
  lookingSinceMs?: number;
  notLookingSinceMs?: number;
}

export class AttentionStateMachine {
  public state: AttentionState = "STANDBY";
  public stateStartedMs = 0;
  public offerStartedMs = 0;
  public lastFaceSeenMs: number | null = null;
  public triggerFaceId: number | null = null;
  public cooldownUntilMs = 0;

  private readonly config: Required<AttentionStateMachineConfig>;
  private readonly tracks = new Map<number, InternalTrack>();
  private readonly triggeredTrackIds = new Set<number>();

  constructor(config: AttentionStateMachineConfig = {}) {
    this.config = {
      dwellSeconds: config.dwellSeconds ?? 3.0,
      offerMinSeconds: config.offerMinSeconds ?? 20.0,
      exitAfterNobodySeconds: config.exitAfterNobodySeconds ?? 6.0,
      cooldownSeconds: config.cooldownSeconds ?? 8.0,
      lookingResetSeconds: config.lookingResetSeconds ?? 0.4,
      triggeringDurationMs: config.triggeringDurationMs ?? 1000,
      exitingDurationMs: config.exitingDurationMs ?? 1000,
      absentToRetriggerSeconds: config.absentToRetriggerSeconds ?? 3.0,
    };
  }

  public get isCooldownActive(): boolean {
    return this.state === "COOLDOWN";
  }

  public get effectivePhase(): "STANDBY" | "TRIGGERING" | "OFFER" | "EXITING" {
    if (this.state === "COOLDOWN") return "STANDBY";
    return this.state;
  }

  public updateConfig(config: AttentionStateMachineConfig): void {
    if (config.dwellSeconds !== undefined) this.config.dwellSeconds = config.dwellSeconds;
    if (config.offerMinSeconds !== undefined) this.config.offerMinSeconds = config.offerMinSeconds;
    if (config.exitAfterNobodySeconds !== undefined) this.config.exitAfterNobodySeconds = config.exitAfterNobodySeconds;
    if (config.cooldownSeconds !== undefined) this.config.cooldownSeconds = config.cooldownSeconds;
    if (config.lookingResetSeconds !== undefined) this.config.lookingResetSeconds = config.lookingResetSeconds;
    if (config.triggeringDurationMs !== undefined) this.config.triggeringDurationMs = config.triggeringDurationMs;
    if (config.exitingDurationMs !== undefined) this.config.exitingDurationMs = config.exitingDurationMs;
    if (config.absentToRetriggerSeconds !== undefined) this.config.absentToRetriggerSeconds = config.absentToRetriggerSeconds;
  }

  public forceTrigger(nowMs: number, faceId: number = 1): void {
    this.state = "TRIGGERING";
    this.stateStartedMs = nowMs;
    this.offerStartedMs = nowMs;
    this.lastFaceSeenMs = nowMs;
    this.triggerFaceId = faceId;
    this.triggeredTrackIds.add(faceId);
  }

  public update(faces: InputFace[], nowMs: number): AttentionState {
    const presentIds = new Set<number>();

    // 1. Update active tracks
    for (const face of faces) {
      presentIds.add(face.id);
      let track = this.tracks.get(face.id);
      if (!track) {
        track = {
          id: face.id,
          firstSeenMs: nowMs,
          lastSeenMs: nowMs,
          isLooking: Boolean(face.looking),
          lookingSinceMs: face.looking ? nowMs : undefined,
        };
        this.tracks.set(face.id, track);
      } else {
        track.lastSeenMs = nowMs;
        if (face.looking) {
          if (track.notLookingSinceMs !== undefined) {
            if (nowMs - track.notLookingSinceMs > this.config.lookingResetSeconds * 1000) {
              track.lookingSinceMs = nowMs;
            }
            track.notLookingSinceMs = undefined;
          } else if (track.lookingSinceMs === undefined) {
            track.lookingSinceMs = nowMs;
          }
          track.isLooking = true;
        } else {
          track.isLooking = false;
          if (track.notLookingSinceMs === undefined) {
            track.notLookingSinceMs = nowMs;
          } else if (nowMs - track.notLookingSinceMs > this.config.lookingResetSeconds * 1000) {
            track.lookingSinceMs = undefined;
          }
        }
      }
    }

    // 2. Check absence of non-present tracks
    for (const [id, track] of this.tracks.entries()) {
      if (!presentIds.has(id)) {
        track.isLooking = false;
        if (track.notLookingSinceMs === undefined) {
          track.notLookingSinceMs = nowMs;
        } else if (nowMs - track.notLookingSinceMs > this.config.lookingResetSeconds * 1000) {
          track.lookingSinceMs = undefined;
        }
        if (nowMs - track.lastSeenMs > this.config.absentToRetriggerSeconds * 1000) {
          this.triggeredTrackIds.delete(id);
        }
        if (nowMs - track.lastSeenMs > 15000) {
          this.tracks.delete(id);
        }
      }
    }

    if (faces.length > 0) {
      this.lastFaceSeenMs = nowMs;
    }

    // 3. State transitions
    switch (this.state) {
      case "STANDBY": {
        for (const face of faces) {
          const track = this.tracks.get(face.id);
          if (!track || this.triggeredTrackIds.has(face.id)) {
            continue;
          }
          if (
            track.lookingSinceMs !== undefined &&
            nowMs - track.lookingSinceMs >= this.config.dwellSeconds * 1000
          ) {
            this.triggeredTrackIds.add(face.id);
            this.triggerFaceId = face.id;
            this.state = "TRIGGERING";
            this.stateStartedMs = nowMs;
            this.offerStartedMs = nowMs;
            this.lastFaceSeenMs = nowMs;
            break;
          }
        }
        break;
      }

      case "TRIGGERING": {
        if (nowMs - this.stateStartedMs >= this.config.triggeringDurationMs) {
          this.state = "OFFER";
          this.stateStartedMs = nowMs;
        }
        break;
      }

      case "OFFER": {
        const minimumTimeSatisfied =
          nowMs - this.offerStartedMs >= this.config.offerMinSeconds * 1000;
        const nobodyPresent =
          this.lastFaceSeenMs === null ||
          nowMs - this.lastFaceSeenMs >= this.config.exitAfterNobodySeconds * 1000;

        if (minimumTimeSatisfied && nobodyPresent) {
          this.state = "EXITING";
          this.stateStartedMs = nowMs;
        }
        break;
      }

      case "EXITING": {
        if (nowMs - this.stateStartedMs >= this.config.exitingDurationMs) {
          this.state = "COOLDOWN";
          this.stateStartedMs = nowMs;
          this.cooldownUntilMs = nowMs + this.config.cooldownSeconds * 1000;
        }
        break;
      }

      case "COOLDOWN": {
        if (nowMs >= this.cooldownUntilMs) {
          this.state = "STANDBY";
          this.stateStartedMs = nowMs;
        }
        break;
      }
    }

    return this.state;
  }
}
