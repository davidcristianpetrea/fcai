import { describe, expect, it } from "vitest";
import { PlaylistEngine } from "./playlist";

describe("PlaylistEngine", () => {
  it("advances only after the active item duration", () => {
    let time = 0;
    const engine = new PlaylistEngine(
      { transition: "crossfade", items: [
        { id: "one", src: "one.jpg", kind: "image", durationMs: 1000 },
        { id: "two", src: "two.jpg", kind: "image", durationMs: 1000 },
      ] },
      () => time,
    );
    expect(engine.start()?.id).toBe("one");
    time = 999;
    expect(engine.tick()?.id).toBe("one");
    time = 1000;
    expect(engine.tick()?.id).toBe("two");
  });
});
