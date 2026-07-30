import { describe, expect, it } from "vitest";
import {
  gameplayBetween,
  gameplayFloatBetween,
  gameplayPick,
  gameplayRandom,
  seedFromString,
  setGameplaySeed
} from "../src/utils/random";

describe("seeded gameplay randomness", () => {
  it("replays the same decision stream from the same seed", () => {
    setGameplaySeed(123456);
    const first = [
      gameplayRandom(),
      gameplayBetween(10, 20),
      gameplayFloatBetween(-1, 1),
      gameplayPick(["left", "right", "top"])
    ];
    setGameplaySeed(123456);
    expect([
      gameplayRandom(),
      gameplayBetween(10, 20),
      gameplayFloatBetween(-1, 1),
      gameplayPick(["left", "right", "top"])
    ]).toEqual(first);
  });

  it("derives stable non-negative seeds from run identifiers", () => {
    expect(seedFromString("run_example")).toBe(seedFromString("run_example"));
    expect(seedFromString("run_example")).not.toBe(seedFromString("run_other"));
  });
});
