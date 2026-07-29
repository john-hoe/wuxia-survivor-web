import { artManifest, countMissingRequiredAssets } from "../data/artManifest";
import { audioEvents, countMissingRequiredAudioEvents } from "../data/audio";
import { MAP_BOSS_IDS } from "../data/bosses";
import { debugConfig, feedbackSettingsDefaults, shakeScaleLevels, stageConfig, stageMapConfig } from "../data/gameConfig";
import type { ConfigLoadResult, GameConfigBundle, ManifestStats } from "../types";

const NOT_LOADED_RESULT: ConfigLoadResult = {
  status: "not_loaded",
  loadedAtMs: 0,
  config: createConfigBundle(),
  errors: []
};

export class ConfigSystem {
  private loadResult: ConfigLoadResult = NOT_LOADED_RESULT;

  load(): ConfigLoadResult {
    const config = createConfigBundle();
    const errors = validateConfig(config);
    this.loadResult = {
      status: errors.length > 0 ? "error" : "loaded",
      loadedAtMs: Math.round(performance.now()),
      config,
      errors
    };
    return cloneLoadResult(this.loadResult);
  }

  getLoadResult(): ConfigLoadResult {
    return cloneLoadResult(this.loadResult);
  }
}

function createConfigBundle(): GameConfigBundle {
  return {
    stage: { ...stageConfig },
    debug: { ...debugConfig },
    art: createManifestStats(artManifest, countMissingRequiredAssets()),
    audio: createManifestStats(audioEvents, countMissingRequiredAudioEvents()),
    loadedConfigIds: [
      "stage:qingshi_mountain_road",
      "debug:default",
      "enemies:p0",
      "progression:inner_power",
      "skills:yulong_sword_qi",
      "waves:combat_001_bandit_only",
      "manifest:art",
      "manifest:audio"
    ]
  };
}

function createManifestStats(items: Array<{ required: boolean }>, missingRequired: number): ManifestStats {
  return {
    total: items.length,
    required: items.filter((item) => item.required).length,
    missingRequired
  };
}

/**
 * QA-005 构建期断言：stageMapConfig.maps 每个条目都必须在 MAP_BOSS_IDS 有显式 Boss 映射，
 * 缺失直接抛错（禁静默回退到默认 Boss）；resolveBossConfigForMap 的 DEFAULT_BOSS_ID 仅作运行时兜底。
 * 模块加载即执行，配置缺失时构建/启动阶段立刻失败，不会进入运行期。
 */
function assertStageMapBossMappings(): void {
  const missingMapIds = stageMapConfig.maps
    .filter((entry) => !(entry.id in MAP_BOSS_IDS))
    .map((entry) => entry.id);
  if (missingMapIds.length > 0) {
    throw new Error(
      `[ConfigSystem] stageMapConfig.maps 存在未登记 Boss 映射的地图：${missingMapIds.join(", ")}。` +
        "请在 game/src/data/bosses.ts 的 MAP_BOSS_IDS 补显式映射（QA-005，禁止静默回退默认 Boss）。"
    );
  }
}
assertStageMapBossMappings();

function validateConfig(config: GameConfigBundle): string[] {
  const errors: string[] = [];
  if (config.stage.id !== "qingshi_mountain_road") {
    errors.push(`Unexpected MVP stage id: ${config.stage.id}`);
  }
  if (config.stage.bossSpawnSeconds !== 360) {
    errors.push(`MVP bossSpawnSeconds must be 360, got ${config.stage.bossSpawnSeconds}`);
  }
  if (config.debug.eventHistoryLimit < 50) {
    errors.push("debug.eventHistoryLimit must be at least 50 for browser sanity assertions");
  }
  if (!config.loadedConfigIds.includes("enemies:p0")) {
    errors.push("Enemy P0 config must be loaded before entering combat");
  }
  if (!config.loadedConfigIds.includes("waves:combat_001_bandit_only")) {
    errors.push("SW-COMBAT-001 wave config must be loaded");
  }
  if (!config.loadedConfigIds.includes("skills:yulong_sword_qi")) {
    errors.push("SW-COMBAT-002 yulong skill config must be loaded");
  }
  if (!config.loadedConfigIds.includes("progression:inner_power")) {
    errors.push("SW-PROG-001 inner power progression config must be loaded");
  }
  if (!(shakeScaleLevels as readonly number[]).includes(feedbackSettingsDefaults.shakeScale)) {
    errors.push("feedbackSettingsDefaults.shakeScale must be one of the shakeScaleLevels presets");
  }
  return errors;
}

function cloneLoadResult(loadResult: ConfigLoadResult): ConfigLoadResult {
  return {
    status: loadResult.status,
    loadedAtMs: loadResult.loadedAtMs,
    errors: [...loadResult.errors],
    config: {
      stage: { ...loadResult.config.stage },
      debug: { ...loadResult.config.debug },
      art: { ...loadResult.config.art },
      audio: { ...loadResult.config.audio },
      loadedConfigIds: [...loadResult.config.loadedConfigIds]
    }
  };
}

export const configSystem = new ConfigSystem();
