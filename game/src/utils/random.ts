/** Seeded gameplay RNG. Presentation and audio randomness stay separate. */
class XorShift32 {
  private state = 0x6d2b79f5;

  setSeed(seed: number): void {
    const normalized = Math.trunc(seed) >>> 0;
    this.state = normalized === 0 ? 0x6d2b79f5 : normalized;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  getState(): number {
    return this.state;
  }
}

const gameplayStream = new XorShift32();

export function setGameplaySeed(seed: number): number {
  gameplayStream.setSeed(seed);
  return gameplayStream.getState();
}

export function getGameplayRandomState(): number {
  return gameplayStream.getState();
}

export function gameplayRandom(): number {
  return gameplayStream.next();
}

export function gameplayBetween(min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return low + Math.floor(gameplayRandom() * (high - low + 1));
}

export function gameplayFloatBetween(min: number, max: number): number {
  return min + gameplayRandom() * (max - min);
}

export function gameplayPick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty collection");
  }
  return items[Math.min(items.length - 1, Math.floor(gameplayRandom() * items.length))];
}

export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
