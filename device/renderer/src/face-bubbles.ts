export interface FaceBubbleInput {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface FaceBubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  score: number;
}

export interface BubbleLayoutOptions {
  width: number;
  height: number;
  peopleSide: "left" | "right" | "top";
  paddingPercent?: number;
  maxFaces?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function layoutFaceBubbles(
  faces: FaceBubbleInput[],
  options: BubbleLayoutOptions,
): FaceBubble[] {
  const padding = options.height * (options.paddingPercent ?? 0.03);
  const maxFaces = options.maxFaces ?? 4;
  const shortSide = Math.min(options.width, options.height);
  const minimumRadius = options.height * 0.1;
  const maximumRadius = options.height * 0.17;
  const sorted = faces.slice().sort((first, second) => second.score - first.score);
  const selected = sorted.slice(0, maxFaces);
  const bubbles: FaceBubble[] = selected.map((face) => ({
    id: face.id,
    x: face.x * options.width,
    y: face.y * options.height,
    radius: clamp(face.h * options.height * 1.1, minimumRadius, maximumRadius),
    score: face.score,
  }));

  const clampToZone = (bubble: FaceBubble): void => {
    if (options.peopleSide === "left") {
      bubble.x = clamp(bubble.x, bubble.radius + padding, options.width / 2 - bubble.radius - padding);
      bubble.y = clamp(bubble.y, bubble.radius + padding, options.height - bubble.radius - padding);
    } else if (options.peopleSide === "right") {
      bubble.x = clamp(bubble.x, options.width / 2 + bubble.radius + padding, options.width - bubble.radius - padding);
      bubble.y = clamp(bubble.y, bubble.radius + padding, options.height - bubble.radius - padding);
    } else {
      bubble.x = clamp(bubble.x, bubble.radius + padding, options.width - bubble.radius - padding);
      bubble.y = clamp(bubble.y, bubble.radius + padding, options.height / 2 - bubble.radius - padding);
    }
  };

  for (const bubble of bubbles) {
    clampToZone(bubble);
  }

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (let first = 0; first < bubbles.length; first += 1) {
      for (let second = first + 1; second < bubbles.length; second += 1) {
        const left = bubbles[first];
        const right = bubbles[second];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const minimumDistance = left.radius + right.radius;
        if (distance < minimumDistance) {
          const amount = (minimumDistance - distance) / 2;
          const unitX = dx / distance;
          const unitY = dy / distance;
          left.x -= unitX * amount;
          left.y -= unitY * amount;
          right.x += unitX * amount;
          right.y += unitY * amount;
        }
      }
    }
    for (const bubble of bubbles) {
      clampToZone(bubble);
    }
  }

  return bubbles.map((bubble) => ({
    ...bubble,
    radius: clamp(bubble.radius, minimumRadius, Math.min(maximumRadius, shortSide * 0.2)),
  }));
}

