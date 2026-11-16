import { layoutFaceBubbles } from "./face-bubbles";

const layout = layoutFaceBubbles(
  [
    { id: 1, x: 0.1, y: 0.5, w: 0.2, h: 0.4, score: 0.9 },
    { id: 2, x: 0.2, y: 0.5, w: 0.2, h: 0.4, score: 0.8 },
  ],
  { width: 1280, height: 720, peopleSide: "left" },
);

if (layout.some((bubble) => bubble.x + bubble.radius > 640)) {
  throw new Error("face bubble crossed into the content panel");
}
