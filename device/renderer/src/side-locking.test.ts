import { describe, expect, it } from "vitest";
import {
  clampFaceToPeopleSide,
  determineSides,
  separateFaces,
} from "./side-locking";

describe("SideLocking", () => {
  it("determines sides opposite to people", () => {
    // People on left (mean x < 0.5) -> content on right
    expect(determineSides([{ x: 0.2 }, { x: 0.3 }])).toEqual({
      peopleSide: "left",
      contentSide: "right",
    });

    // People on right (mean x > 0.5) -> content on left
    expect(determineSides([{ x: 0.7 }, { x: 0.8 }])).toEqual({
      peopleSide: "right",
      contentSide: "left",
    });
  });

  it("clamps face positions strictly inside people half minus 3% margin", () => {
    const screenWidth = 1000;
    const screenHeight = 600;
    const radius = 50;
    const margin = 1000 * 0.03; // 30px

    // People side: left (allowed range: [80, 500 - 80] = [80, 420])
    // Face trying to cross over into content side (x = 480):
    const clampedLeft = clampFaceToPeopleSide(
      480,
      300,
      radius,
      "left",
      screenWidth,
      screenHeight,
    );
    expect(clampedLeft.cx).toBe(420); // exactly 500 - radius - margin
    expect(clampedLeft.cx + radius).toBeLessThanOrEqual(screenWidth / 2);

    // People side: right (allowed range: [500 + 80, 1000 - 80] = [580, 920])
    // Face trying to cross over into content side (x = 520):
    const clampedRight = clampFaceToPeopleSide(
      520,
      300,
      radius,
      "right",
      screenWidth,
      screenHeight,
    );
    expect(clampedRight.cx).toBe(580); // exactly 500 + radius + margin
    expect(clampedRight.cx - radius).toBeGreaterThanOrEqual(screenWidth / 2);
  });

  it("pushes overlapping faces apart without crossing into content panel", () => {
    const screenWidth = 1000;
    const screenHeight = 600;
    const radius = 50;

    // Two faces at nearly the same position on the left side
    const faces = [
      { id: 1, cx: 250, cy: 300, radius },
      { id: 2, cx: 260, cy: 310, radius },
    ];

    const separated = separateFaces(faces, "left", screenWidth, screenHeight);
    const dist = Math.hypot(separated[0].cx - separated[1].cx, separated[0].cy - separated[1].cy);
    expect(dist).toBeGreaterThanOrEqual(radius * 1.5);

    // Neither crossed into content half (x > 500)
    expect(separated[0].cx + radius).toBeLessThan(500);
    expect(separated[1].cx + radius).toBeLessThan(500);
  });
});
