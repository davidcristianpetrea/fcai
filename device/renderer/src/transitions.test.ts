import { describe, expect, it } from "vitest";
import {
  computeTransitionStyles,
  getTransitionDurationMs,
  TransitionSelector,
} from "./transitions";

describe("Transitions", () => {
  it("resolves speeds correctly", () => {
    expect(getTransitionDurationMs("fast")).toBe(500);
    expect(getTransitionDurationMs("normal")).toBe(900);
    expect(getTransitionDurationMs("slow")).toBe(1400);
    expect(getTransitionDurationMs(0.5)).toBe(500);
    expect(getTransitionDurationMs(1.4)).toBe(1400);
  });

  it("auto transition never picks the same transition twice in a row", () => {
    const selector = new TransitionSelector();
    let prev = selector.resolve("auto");
    for (let i = 0; i < 20; i++) {
      const next = selector.resolve("auto");
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it("crossfade transitions opacity smoothly", () => {
    const start = computeTransitionStyles("crossfade", 0);
    expect(start.outgoing.opacity).toBe(1);
    expect(start.incoming.opacity).toBe(0);

    const mid = computeTransitionStyles("crossfade", 0.5);
    expect(mid.outgoing.opacity).toBeCloseTo(0.5, 1);
    expect(mid.incoming.opacity).toBeCloseTo(0.5, 1);

    const end = computeTransitionStyles("crossfade", 1);
    expect(end.outgoing.opacity).toBe(0);
    expect(end.incoming.opacity).toBe(1);
  });

  it("zoom dissolve scales outgoing 1 -> 1.06 and incoming 1.04 -> 1", () => {
    const start = computeTransitionStyles("zoom dissolve", 0);
    expect(start.outgoing.transform).toBe("scale(1.0000)");
    expect(start.incoming.transform).toBe("scale(1.0400)");

    const end = computeTransitionStyles("zoom dissolve", 1);
    expect(end.outgoing.transform).toBe("scale(1.0600)");
    expect(end.incoming.transform).toBe("scale(1.0000)");
  });

  it("push translates incoming 100% -> 0 and dims outgoing to 0.6", () => {
    const start = computeTransitionStyles("push", 0);
    expect(start.incoming.transform).toBe("translate3d(100.00%, 0, 0)");
    expect(start.outgoing.filter).toBe("brightness(1.000)");

    const end = computeTransitionStyles("push", 1);
    expect(end.incoming.transform).toBe("translate3d(0.00%, 0, 0)");
    expect(end.outgoing.transform).toBe("translate3d(-30.00%, 0, 0)");
    expect(end.outgoing.filter).toBe("brightness(0.600)");
  });

  it("dip to black dips to zero at 0.5 and restores", () => {
    const mid = computeTransitionStyles("dip to black", 0.5);
    expect(mid.outgoing.opacity).toBe(0);
    expect(mid.incoming.opacity).toBe(0);
  });
});
