import { describe, expect, it } from "vitest";
import { FaceBlender } from "./face-blender";

describe("FaceBlender", () => {
  it("clamps blend height to 10-28% of screen height", () => {
    const blender = new FaceBlender(4);
    const screenHeight = 1000;
    const screenWidth = 1920;

    // Small face (h = 0.04): 1.7 * 0.04 * 1000 = 68 -> clamped to 100 (10%)
    blender.update([{ id: 1, x: 0.5, y: 0.5, w: 0.04, h: 0.04 }], 0, screenWidth, screenHeight);
    const trackSmall = blender.getTrack(1);
    expect(trackSmall?.currentSize).toBe(100);

    // Large face (h = 0.30): 1.7 * 0.30 * 1000 = 510 -> clamped to 280 (28%)
    blender.update([{ id: 2, x: 0.5, y: 0.5, w: 0.30, h: 0.30 }], 0, screenWidth, screenHeight);
    const trackLarge = blender.getTrack(2);
    expect(trackLarge?.currentSize).toBe(280);

    // Medium face (h = 0.10): 1.7 * 0.10 * 1000 = 170 -> between 100 and 280
    blender.update([{ id: 3, x: 0.5, y: 0.5, w: 0.10, h: 0.10 }], 0, screenWidth, screenHeight);
    const trackMed = blender.getTrack(3);
    expect(trackMed?.currentSize).toBe(170);
  });

  it("fades/scales in over 250ms, holds for 600ms after lost, and fades out over 300ms", () => {
    const blender = new FaceBlender(4);
    const face = { id: 1, x: 0.5, y: 0.5, w: 0.1, h: 0.1 };

    // t = 0: enters
    blender.update([face], 0, 1000, 1000);
    let track = blender.getTrack(1);
    expect(track?.alpha).toBe(0.0);
    expect(track?.scale).toBe(0.85);

    // t = 125ms: half fade-in
    blender.update([face], 125, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBeCloseTo(0.5, 1);
    expect(track?.scale).toBeCloseTo(0.925, 1);

    // t = 250ms: fully faded in
    blender.update([face], 250, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBe(1.0);
    expect(track?.scale).toBe(1.0);

    // Face lost at t = 250ms (faces = [])
    // t = 550ms (300ms lost <= 600ms hold): remains at 1.0
    blender.update([], 550, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBe(1.0);

    // t = 850ms (exactly 600ms lost): still holds at 1.0
    blender.update([], 850, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBe(1.0);

    // t = 1000ms (150ms into 300ms fade out): alpha is ~0.5
    blender.update([], 1000, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBeCloseTo(0.5, 1);

    // t = 1150ms (300ms fade out complete): alpha reaches 0.0
    blender.update([], 1150, 1000, 1000);
    track = blender.getTrack(1);
    expect(track?.alpha).toBe(0.0);

    // t = 1160ms: track is deleted
    blender.update([], 1160, 1000, 1000);
    expect(blender.getTrack(1)).toBeUndefined();
  });

  it("limits tracking to at most 4 people", () => {
    const blender = new FaceBlender(4);
    const faces = [
      { id: 1, x: 0.1, y: 0.5, w: 0.1, h: 0.1 },
      { id: 2, x: 0.2, y: 0.5, w: 0.1, h: 0.1 },
      { id: 3, x: 0.3, y: 0.5, w: 0.1, h: 0.1 },
      { id: 4, x: 0.4, y: 0.5, w: 0.1, h: 0.1 },
      { id: 5, x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      { id: 6, x: 0.6, y: 0.5, w: 0.1, h: 0.1 },
    ];

    blender.update(faces, 0, 1000, 1000);
    expect(blender.getTrack(1)).toBeDefined();
    expect(blender.getTrack(4)).toBeDefined();
    expect(blender.getTrack(5)).toBeUndefined();
    expect(blender.getTrack(6)).toBeUndefined();
  });
});
