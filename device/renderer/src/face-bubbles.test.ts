import { describe, expect, it } from "vitest";
import { layoutFaceBubbles } from "./face-bubbles";

describe("layoutFaceBubbles", () => {
  it("does not allow face bubbles to cross into the content panel", () => {
    const layout = layoutFaceBubbles(
      [
        { id: 1, x: 0.1, y: 0.5, w: 0.2, h: 0.4, score: 0.9 },
        { id: 2, x: 0.2, y: 0.5, w: 0.2, h: 0.4, score: 0.8 },
      ],
      { width: 1280, height: 720, peopleSide: "left" },
    );

    expect(layout.some((bubble) => bubble.x + bubble.radius > 640)).toBe(false);
  });
});
