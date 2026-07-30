import { beforeEach, describe, expect, it, vi } from "vitest";
import { stageMapConfig } from "../src/data/gameConfig";
import { SAVE_KEY, SaveSystem } from "../src/systems/SaveSystem";

type StorageStub = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
};

function installStorage(raw: string | null): StorageStub {
  const storage = {
    getItem: vi.fn(() => raw),
    setItem: vi.fn()
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage }
  });
  return storage;
}

describe("SaveSystem compatibility and durability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("preserves a newer schema and blocks accidental overwrite", () => {
    const storage = installStorage(JSON.stringify({ schemaVersion: 2, copper: 999 }));
    const system = new SaveSystem();

    const loaded = system.load();
    const written = system.write({ ...loaded, copper: 1 });

    expect(loaded.schemaVersion).toBe(1);
    expect(written).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(system.getStatus()).toBe("write_blocked");
  });

  it("survives localStorage read errors without attempting a write", () => {
    const storage = installStorage(null);
    storage.getItem.mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const system = new SaveSystem();

    expect(system.load().copper).toBe(0);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(system.getStatus()).toBe("storage_unavailable");
  });

  it("accepts every configured map and clamps untrusted numeric fields", () => {
    const system = new SaveSystem();
    const requestedMap = stageMapConfig.maps.at(-1)?.id;
    const storage = installStorage(JSON.stringify({
      ...system.createDefaultSave(),
      lastMapId: requestedMap,
      copper: Number.POSITIVE_INFINITY,
      bestKills: -40,
      bestLevel: 2.9,
      metaUpgrades: { max_hp: 999, move_speed: -2, pickup_radius: 3.8 },
      settings: { masterVolume: 8, musicVolume: -1, sfxVolume: 0.4 }
    }));

    const loaded = system.load();

    expect(storage.getItem).toHaveBeenCalledWith(SAVE_KEY);
    expect(loaded.lastMapId).toBe(requestedMap);
    expect(loaded.copper).toBe(0);
    expect(loaded.bestKills).toBe(0);
    expect(loaded.bestLevel).toBe(2);
    expect(loaded.metaUpgrades).toEqual({ max_hp: 5, move_speed: 0, pickup_radius: 3 });
    expect(loaded.settings.masterVolume).toBe(1);
    expect(loaded.settings.musicVolume).toBe(0);
  });

  it("keeps a failed settings change for the current session", () => {
    const storage = installStorage(null);
    storage.setItem.mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const system = new SaveSystem();
    const save = system.createDefaultSave();

    const result = system.updateSettings({ ...save.settings, lowVfxMode: true }, save);

    expect(result.written).toBe(false);
    expect(result.saveData.settings.lowVfxMode).toBe(true);
  });
});
