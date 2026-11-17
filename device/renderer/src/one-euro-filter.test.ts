import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./one-euro-filter";

describe("OneEuroFilter", () => {
  it("initializes with the first value immediately", () => {
    const filter = new OneEuroFilter();
    expect(filter.filter(100, 0)).toBe(100);
  });

  it("reduces high-frequency jitter when signal is stationary", () => {
    const filter = new OneEuroFilter(1.0, 0.007);
    filter.filter(100, 0);

    const values: number[] = [];
    // Feed oscillating jitter around 100 (+/- 2)
    for (let i = 1; i <= 20; i++) {
      const noisy = 100 + (i % 2 === 0 ? 2 : -2);
      const filtered = filter.filter(noisy, i * 33);
      values.push(filtered);
    }

    // Filtered variation should be significantly smaller than raw noise amplitude (2)
    const maxDeviation = Math.max(...values.map((v) => Math.abs(v - 100)));
    expect(maxDeviation).toBeLessThan(1.0);
  });

  it("tracks fast motion without significant lag", () => {
    const filter = new OneEuroFilter(1.0, 0.007);
    filter.filter(0, 0);

    // Fast moving target: moving 50 units every 33ms
    let lastFiltered = 0;
    for (let i = 1; i <= 10; i++) {
      lastFiltered = filter.filter(i * 50, i * 33);
    }

    // At the end of the fast motion, filtered value should closely follow target (500)
    expect(lastFiltered).toBeGreaterThan(450);
  });
});
