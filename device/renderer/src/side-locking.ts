export type PeopleSide = "left" | "right";
export type ContentSide = "left" | "right";

export interface FacePosition {
  id: number;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  radius: number; // in pixels
}

export interface SideLockingResult {
  peopleSide: PeopleSide;
  contentSide: ContentSide;
}

export function determineSides(faces: { x: number }[]): SideLockingResult {
  if (faces.length === 0) {
    return { peopleSide: "left", contentSide: "right" };
  }
  const meanX = faces.reduce((sum, f) => sum + f.x, 0) / faces.length;
  const peopleSide: PeopleSide = meanX < 0.5 ? "left" : "right";
  const contentSide: ContentSide = peopleSide === "left" ? "right" : "left";
  return { peopleSide, contentSide };
}

export function clampFaceToScreen(
  cx: number,
  cy: number,
  radius: number,
  screenWidth: number,
  screenHeight: number,
  marginPercent = 0.03,
): { cx: number; cy: number } {
  const margin = Math.round(screenWidth * marginPercent);
  const minY = radius + margin;
  const maxY = screenHeight - radius - margin;
  const minX = radius + margin;
  const maxX = screenWidth - radius - margin;
  const clampedX = Math.max(minX, Math.min(maxX, cx));
  const clampedY = Math.max(minY, Math.min(maxY, cy));
  return { cx: clampedX, cy: clampedY };
}

export function clampFaceToPeopleSide(
  cx: number,
  cy: number,
  radius: number,
  peopleSide: PeopleSide,
  screenWidth: number,
  screenHeight: number,
  marginPercent = 0.03,
): { cx: number; cy: number } {
  const margin = Math.round(screenWidth * marginPercent);
  const minY = radius + margin;
  const maxY = screenHeight - radius - margin;
  const clampedY = Math.max(minY, Math.min(maxY, cy));

  let minX: number;
  let maxX: number;

  if (peopleSide === "left") {
    minX = radius + margin;
    maxX = screenWidth / 2 - radius - margin;
  } else {
    minX = screenWidth / 2 + radius + margin;
    maxX = screenWidth - radius - margin;
  }

  // If face radius is too large for the half minus margins, clamp to center of the half
  if (minX > maxX) {
    const halfCenter = peopleSide === "left" ? screenWidth * 0.25 : screenWidth * 0.75;
    return { cx: halfCenter, cy: clampedY };
  }

  const clampedX = Math.max(minX, Math.min(maxX, cx));
  return { cx: clampedX, cy: clampedY };
}

export function separateFaces(
  faces: { id: number; cx: number; cy: number; radius: number }[],
  peopleSide: PeopleSide,
  screenWidth: number,
  screenHeight: number,
  isOfferActive = false,
  iterations = 4,
): { id: number; cx: number; cy: number; radius: number }[] {
  const result = faces.map((f) => ({ ...f }));

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = a.radius + b.radius;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.cx -= ux * overlap;
          a.cy -= uy * overlap;
          b.cx += ux * overlap;
          b.cy += uy * overlap;
        }
      }
    }

    // Re-clamp all to boundary
    for (const f of result) {
      const clamped = isOfferActive
        ? clampFaceToPeopleSide(
            f.cx,
            f.cy,
            f.radius,
            peopleSide,
            screenWidth,
            screenHeight,
          )
        : clampFaceToScreen(
            f.cx,
            f.cy,
            f.radius,
            screenWidth,
            screenHeight,
          );
      f.cx = clamped.cx;
      f.cy = clamped.cy;
    }
  }

  return result;
}
