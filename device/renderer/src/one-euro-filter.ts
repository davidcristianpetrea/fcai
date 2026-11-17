function alpha(rate: number, cutoff: number): number {
  const tau = 1.0 / (2.0 * Math.PI * cutoff);
  const te = 1.0 / rate;
  return 1.0 / (1.0 + tau / te);
}

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alphaVal: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = alphaVal * value + (1.0 - alphaVal) * this.s!;
    this.s = this.y;
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(x: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      return this.xFilter.filter(x, 1.0);
    }

    const dt = Math.max((timestampMs - this.lastTime) / 1000.0, 1e-4);
    this.lastTime = timestampMs;

    const rate = 1.0 / dt;
    const dx = this.xFilter.hasLast() ? (x - this.xFilter.last()) * rate : 0;
    const edx = this.dxFilter.filter(dx, alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, alpha(rate, cutoff));
  }

  reset(): void {
    this.lastTime = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}
