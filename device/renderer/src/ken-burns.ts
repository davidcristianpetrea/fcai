import type { KenBurnsConfig } from "./types";

export function kenBurnsTransform(config: KenBurnsConfig, progress: number): string {
  const amount = Math.max(0, Math.min(1, progress));
  const scale = config.fromScale + (config.toScale - config.fromScale) * amount;
  const x = config.fromX + (config.toX - config.fromX) * amount;
  const y = config.fromY + (config.toY - config.fromY) * amount;
  return `translate(${x}%, ${y}%) scale(${scale})`;
}
