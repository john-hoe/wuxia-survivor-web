import { feedbackSettingsDefaults, shakeScaleLevels } from "../data/gameConfig";
import type { GameSettings, SaveData } from "../types";
import { eventBus } from "../utils/EventBus";

export const SAVE_KEY = "wuxia_survivor_web_save_v1";

export class SaveSystem {
  private lastStatus = "not_loaded";

  load(): SaveData {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const saveData = this.createDefaultSave();
      this.write(saveData);
      return saveData;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.schemaVersion !== 1) {
        throw new Error("Unsupported save schema");
      }
      this.lastStatus = "loaded";
      return this.withDefaults(parsed);
    } catch {
      const saveData = this.createDefaultSave();
      this.write(saveData);
      this.lastStatus = "rebuilt_default";
      return saveData;
    }
  }

  write(saveData: SaveData): boolean {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      this.lastStatus = "written";
      eventBus.emit("save_written", {
        schemaVersion: saveData.schemaVersion,
        copper: saveData.copper,
        bestTimeSeconds: saveData.bestTimeSeconds,
        bestKills: saveData.bestKills,
        bestLevel: saveData.bestLevel
      });
      return true;
    } catch (error) {
      this.lastStatus = "write_failed";
      console.warn("Save write failed; localStorage may be unavailable.", error);
      return false;
    }
  }

  updateSettings(settings: GameSettings, currentSaveData?: SaveData): SaveData {
    const saveData = currentSaveData ?? this.load();
    saveData.settings = { ...settings };
    this.write(saveData);
    return saveData;
  }

  getStatus(): string {
    return this.lastStatus;
  }

  createDefaultSave(): SaveData {
    return {
      schemaVersion: 1,
      copper: 0,
      bestTimeSeconds: 0,
      bestKills: 0,
      bestLevel: 1,
      bossDefeated: false,
      metaUpgrades: {
        max_hp: 0,
        move_speed: 0,
        pickup_radius: 0
      },
      scriptureGacha: {
        starter_scripture_pool: {
          pulls: 0,
          pityCounter: 0
        }
      },
      collection: {
        skins: [],
        titles: [],
        fragments: {}
      },
      settings: {
        masterVolume: 1,
        musicVolume: 0.6,
        sfxVolume: 0.8,
        muted: false,
        lowVfxMode: false,
        damageNumbers: feedbackSettingsDefaults.damageNumbers,
        shakeScale: feedbackSettingsDefaults.shakeScale
      }
    };
  }

  private withDefaults(saveData: Partial<SaveData>): SaveData {
    const defaultSave = this.createDefaultSave();
    return {
      ...defaultSave,
      ...saveData,
      copper: this.readNonNegativeInteger(saveData.copper, defaultSave.copper),
      bestTimeSeconds: this.readNonNegativeInteger(saveData.bestTimeSeconds, defaultSave.bestTimeSeconds),
      bestKills: this.readNonNegativeInteger(saveData.bestKills, defaultSave.bestKills),
      bestLevel: Math.max(1, this.readNonNegativeInteger(saveData.bestLevel, defaultSave.bestLevel)),
      bossDefeated: this.readBoolean(saveData.bossDefeated, defaultSave.bossDefeated),
      metaUpgrades: {
        max_hp: this.readUpgradeLevel(saveData.metaUpgrades?.max_hp, defaultSave.metaUpgrades.max_hp),
        move_speed: this.readUpgradeLevel(saveData.metaUpgrades?.move_speed, defaultSave.metaUpgrades.move_speed),
        pickup_radius: this.readUpgradeLevel(saveData.metaUpgrades?.pickup_radius, defaultSave.metaUpgrades.pickup_radius)
      },
      scriptureGacha: {
        starter_scripture_pool: {
          pulls: this.readNonNegativeInteger(saveData.scriptureGacha?.starter_scripture_pool?.pulls, 0),
          pityCounter: this.readNonNegativeInteger(saveData.scriptureGacha?.starter_scripture_pool?.pityCounter, 0)
        }
      },
      collection: {
        skins: Array.isArray(saveData.collection?.skins) ? saveData.collection.skins.filter((item): item is string => typeof item === "string") : [],
        titles: Array.isArray(saveData.collection?.titles) ? saveData.collection.titles.filter((item): item is string => typeof item === "string") : [],
        fragments: this.readFragments(saveData.collection?.fragments)
      },
      settings: {
        masterVolume: this.readVolume(saveData.settings?.masterVolume, 1),
        musicVolume: this.readVolume(saveData.settings?.musicVolume, 0.6),
        sfxVolume: this.readVolume(saveData.settings?.sfxVolume, 0.8),
        muted: this.readBoolean(saveData.settings?.muted, false),
        lowVfxMode: this.readBoolean(saveData.settings?.lowVfxMode, false),
        damageNumbers: this.readBoolean(saveData.settings?.damageNumbers, feedbackSettingsDefaults.damageNumbers),
        shakeScale: this.readShakeScale(saveData.settings?.shakeScale)
      }
    };
  }

  /** 震屏强度读档兼容：旧档缺字段或值非法时回默认，非三档取值吸附最近档。 */
  private readShakeScale(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return feedbackSettingsDefaults.shakeScale;
    }
    let nearestLevel: number = shakeScaleLevels[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const level of shakeScaleLevels) {
      const distance = Math.abs(value - level);
      if (distance < nearestDistance) {
        nearestLevel = level;
        nearestDistance = distance;
      }
    }
    return nearestLevel;
  }

  private readNonNegativeInteger(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(0, Math.floor(value));
  }

  private readUpgradeLevel(value: unknown, fallback: number): number {
    return Math.min(5, this.readNonNegativeInteger(value, fallback));
  }

  private readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  private readVolume(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(1, Math.max(0, value));
  }

  private readFragments(value: unknown): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([key, amount]) => [key, Math.max(0, Math.floor(amount))]));
  }
}

export const saveSystem = new SaveSystem();
