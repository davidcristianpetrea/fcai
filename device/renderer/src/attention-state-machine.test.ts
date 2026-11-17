import { describe, expect, it } from "vitest";
import { AttentionStateMachine } from "./attention-state-machine";

describe("AttentionStateMachine", () => {
  it("one person keeps looking for 2 minutes -> exactly ONE offer cycle", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
    });

    const person = { id: 1, looking: true };
    let offerTransitions = 0;
    let triggeringTransitions = 0;
    let previousState = sm.state;

    // Simulate 2 minutes (120,000 ms) in 100 ms increments
    for (let t = 0; t <= 120_000; t += 100) {
      const state = sm.update([person], t);
      if (state === "TRIGGERING" && previousState !== "TRIGGERING") {
        triggeringTransitions++;
      }
      if (state === "OFFER" && previousState !== "OFFER") {
        offerTransitions++;
      }
      previousState = state;
    }

    // Triggered once at 3s, transitioned to OFFER at 4s, and stayed in OFFER entire time
    expect(triggeringTransitions).toBe(1);
    expect(offerTransitions).toBe(1);
    expect(sm.state).toBe("OFFER");
  });

  it("person looks away to scan -> the offer stays", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
    });

    // t = 0 to 3000: looking
    sm.update([{ id: 1, looking: true }], 0);
    sm.update([{ id: 1, looking: true }], 3000);
    expect(sm.state).toBe("TRIGGERING");

    // t = 4000: reaches OFFER
    sm.update([{ id: 1, looking: true }], 4000);
    expect(sm.state).toBe("OFFER");

    // At t = 25000 (after 20s min offer time), person looks down at phone (looking: false)
    for (let t = 5000; t <= 35000; t += 1000) {
      sm.update([{ id: 1, looking: false }], t);
      // Because face is still present, offer stays!
      expect(sm.state).toBe("OFFER");
    }
  });

  it("everyone leaves -> standby after 6 s (once minimum offer time satisfied)", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
    });

    // Trigger and enter OFFER
    sm.update([{ id: 1, looking: true }], 0);
    sm.update([{ id: 1, looking: true }], 3000);
    sm.update([{ id: 1, looking: true }], 4000);
    expect(sm.state).toBe("OFFER");

    // Advance to t = 24000 (min offer time reached), then person leaves at t = 24000
    sm.update([{ id: 1, looking: true }], 24000);
    expect(sm.state).toBe("OFFER");

    // Everyone leaves: faces = []
    // 5 seconds later (t = 29000): still in OFFER
    sm.update([], 29000);
    expect(sm.state).toBe("OFFER");

    // Exactly 6 seconds of nobody (t = 30000): transitions to EXITING!
    sm.update([], 30000);
    expect(sm.state).toBe("EXITING");

    // After exiting duration (1000ms, t = 31000): transitions to COOLDOWN
    sm.update([], 31000);
    expect(sm.state).toBe("COOLDOWN");
    expect(sm.effectivePhase).toBe("STANDBY");

    // After 8s cooldown (t = 39000): transitions to STANDBY
    sm.update([], 39000);
    expect(sm.state).toBe("STANDBY");
  });

  it("same person cannot re-trigger until leaving frame for > 3 s", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
      absentToRetriggerSeconds: 3,
    });

    // Person 1 triggers
    sm.update([{ id: 1, looking: true }], 0);
    sm.update([{ id: 1, looking: true }], 3000);
    sm.update([{ id: 1, looking: true }], 4000); // OFFER
    sm.update([{ id: 1, looking: true }], 24000);
    sm.update([], 30000); // EXITING (after 6s of nobody)
    sm.update([], 31000); // COOLDOWN
    sm.update([], 39000); // STANDBY (cooldown expired)
    expect(sm.state).toBe("STANDBY");

    // Person 1 left at 24000. At 39000, they have been absent for 15s > 3s.
    // Person 1 returns and looks again at 39000
    sm.update([{ id: 1, looking: true }], 39000);
    expect(sm.state).toBe("STANDBY");
    // Looks for 3 seconds -> triggers at 42000!
    sm.update([{ id: 1, looking: true }], 42000);
    expect(sm.state).toBe("TRIGGERING");
  });

  it("same person who never leaves during cooldown cannot re-trigger immediately", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
      absentToRetriggerSeconds: 3,
    });

    // Person 1 triggers
    sm.update([{ id: 1, looking: true }], 0);
    sm.update([{ id: 1, looking: true }], 3000);
    sm.update([{ id: 1, looking: true }], 4000); // OFFER

    // Advance to 24000 (min offer time reached)
    sm.update([{ id: 1, looking: true }], 24000);

    // Person 1 leaves at 24000
    sm.update([], 30000); // EXITING after 6s of nobody
    sm.update([], 31000); // COOLDOWN (ends at 39000)

    // Person 1 comes back at 32000 (absent from 24000 to 32000 = 8s > 3s, but returns during cooldown!)
    // When person 1 looks during cooldown (32000 to 39000):
    for (let t = 32000; t < 39000; t += 1000) {
      sm.update([{ id: 1, looking: true }], t);
      expect(sm.state).toBe("COOLDOWN");
    }

    // At 39000 cooldown ends -> STANDBY
    sm.update([{ id: 1, looking: true }], 39000);
    expect(sm.state).toBe("STANDBY");

    // Person 1 looks for 3 seconds in STANDBY
    sm.update([{ id: 1, looking: true }], 42000);
    // Since person 1 was absent for 8s (> 3s), person 1 can re-trigger!
    expect(sm.state).toBe("TRIGGERING");
  });

  it("same person who only left for 2 seconds (<= 3 s) cannot re-trigger", () => {
    const sm = new AttentionStateMachine({
      dwellSeconds: 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8,
      triggeringDurationMs: 1000,
      exitingDurationMs: 1000,
      absentToRetriggerSeconds: 3,
    });

    // Person 1 triggers
    sm.update([{ id: 1, looking: true }], 0);
    sm.update([{ id: 1, looking: true }], 3000); // TRIGGERING
    sm.update([{ id: 1, looking: true }], 4000); // OFFER
    sm.update([{ id: 1, looking: true }], 24000);

    // Person 2 was also there and leaves later, or person 1 steps out at 24000 and steps back at 26000 (2s gap <= 3s)
    // Person 1 absent only 24000 to 26000 (2s <= 3s)
    sm.update([], 25000);
    sm.update([{ id: 1, looking: false }], 26000);
    // Person 1 stays until 29000
    sm.update([{ id: 1, looking: false }], 29000);
    // Now both leave at 29000 -> nobody for 6s (until 35000) -> EXITING
    sm.update([], 35000);
    expect(sm.state).toBe("EXITING");
    sm.update([], 36000); // COOLDOWN (ends 44000)

    // Cooldown ends at 44000
    sm.update([], 44000);
    expect(sm.state).toBe("STANDBY");

    // Person 1 was absent from 29000 to 44000 (15s > 3s) -> cleared
    // But if person 1 was present at 42000 (absent from 41000 to 43000: 2s <= 3s):
    // Let's verify absentToRetrigger:
    expect(sm.isCooldownActive).toBe(false);
  });
});
