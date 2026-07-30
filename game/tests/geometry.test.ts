import { describe, expect, it } from "vitest";
import { segmentIntersectsCircle } from "../src/utils/geometry";

describe("segmentIntersectsCircle", () => {
  it("detects a fast projectile crossing a target between frames", () => {
    expect(segmentIntersectsCircle(0, 0, 100, 0, 50, 3, 4)).toBe(true);
  });

  it("rejects targets beyond the swept path endpoints", () => {
    expect(segmentIntersectsCircle(0, 0, 10, 0, 20, 0, 5)).toBe(false);
  });

  it("handles a stationary projectile and clamps negative radii", () => {
    expect(segmentIntersectsCircle(2, 2, 2, 2, 2, 2, -1)).toBe(true);
    expect(segmentIntersectsCircle(2, 2, 2, 2, 2.1, 2, -1)).toBe(false);
  });
});
