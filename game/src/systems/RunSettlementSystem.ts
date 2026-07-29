import Phaser from "phaser";
import { bossConfigsById, DEFAULT_BOSS_ID } from "../data/bosses";
import type { BossId } from "../data/bosses";
import type { RunResultKind, RunSummary, SaveData } from "../types";
import { eventBus } from "../utils/EventBus";
import { getSaveData, setRunSummary, setSaveData } from "../utils/registry";
import { saveSystem } from "./SaveSystem";

const DIFFICULTY_MULTIPLIER = 1;
const SETTLED_RUN_IDS_KEY = "settledRunIds";

export type RunCopperBreakdown = {
  survivalCopper: number;
  killCopper: number;
  levelCopper: number;
  baseCopper: number;
  bossBonus: number;
  /** QA-002：实际计入奖励的 Boss id（bossBonus > 0 时存在；summary 未携带 bossId 时为默认 Boss 兜底）。 */
  bossRewardBossId?: BossId;
  /** QA-002：被击败 Boss 的显示名，供结算明细文案使用。 */
  bossRewardDisplayName?: string;
  difficultyMultiplier: number;
  copperEarned: number;
};

export type RunSettlement = {
  runSummary: RunSummary;
  saveData: SaveData;
  copperBreakdown: RunCopperBreakdown;
  totalCopperBefore: number;
  totalCopperAfter: number;
  saveWritten: boolean;
  alreadyApplied: boolean;
};

export function calculateRunCopper(summary: RunSummary): RunCopperBreakdown {
  const isRewardable = summary.result === "dead" || summary.result === "win";
  const survivalSeconds = readNonNegativeInteger(summary.survivalSeconds);
  const kills = readNonNegativeInteger(summary.kills);
  const level = Math.max(1, readNonNegativeInteger(summary.level));
  const survivalCopper = isRewardable ? Math.floor(survivalSeconds / 10) : 0;
  const killCopper = isRewardable ? kills : 0;
  const levelCopper = isRewardable ? level * 8 : 0;
  const baseCopper = survivalCopper + killCopper + levelCopper;
  // QA-002：Boss 奖励按实际被击败 Boss 的 copperReward 结算（断剑镖头 180 / 黑风寨主 150），不再固定 150
  const bossRewardConfig = isRewardable && summary.bossDefeated ? resolveBossRewardConfig(summary) : undefined;
  const bossBonus = bossRewardConfig?.copperReward ?? 0;
  const copperEarned = Math.floor((baseCopper + bossBonus) * DIFFICULTY_MULTIPLIER);

  return {
    survivalCopper,
    killCopper,
    levelCopper,
    baseCopper,
    bossBonus,
    bossRewardBossId: bossRewardConfig?.id,
    bossRewardDisplayName: bossRewardConfig?.displayName,
    difficultyMultiplier: DIFFICULTY_MULTIPLIER,
    copperEarned
  };
}

/**
 * QA-002：解析本次实际被击败 Boss 的配置。
 * bossId 缺失/非法（旧链路未携带、调试路径）时回退默认 Boss，保持历史结算行为不变。
 */
function resolveBossRewardConfig(summary: RunSummary): (typeof bossConfigsById)[BossId] {
  return bossConfigsById[readSummaryBossId(summary) ?? DEFAULT_BOSS_ID];
}

/**
 * 防御性读取 RunSummary.bossId：types.ts 的 RunSummary 字段由其他代理补充，
 * 未补前运行期载荷仍可能带值（BossSystem boss_defeated 事件载荷含 bossId），此处按 unknown 收窄。
 */
function readSummaryBossId(summary: RunSummary): BossId | undefined {
  const raw = (summary as RunSummary & { bossId?: unknown }).bossId;
  return typeof raw === "string" && raw in bossConfigsById ? (raw as BossId) : undefined;
}

export function applyRunSettlement(scene: Phaser.Scene, inputSummary: RunSummary): RunSettlement {
  const currentSaveData = getSaveData(scene);
  const runSummary = normalizeRunSummary(inputSummary);
  const copperBreakdown = calculateRunCopper(runSummary);
  const settledRunIds = getSettledRunIds(scene);
  const alreadyApplied = settledRunIds.includes(runSummary.runId);
  const totalCopperBefore = currentSaveData.copper;
  const nextRunSummary = {
    ...runSummary,
    copperEarned: copperBreakdown.copperEarned
  };

  if (alreadyApplied) {
    setRunSummary(scene, nextRunSummary);
    eventBus.emit("run_result_calculated", {
      runId: nextRunSummary.runId,
      result: nextRunSummary.result,
      survivalSeconds: nextRunSummary.survivalSeconds,
      kills: nextRunSummary.kills,
      level: nextRunSummary.level,
      bossDefeated: nextRunSummary.bossDefeated,
      copperEarned: nextRunSummary.copperEarned,
      baseCopper: copperBreakdown.baseCopper,
      bossBonus: copperBreakdown.bossBonus,
      alreadyApplied: true,
      saveWritten: false
    });
    return {
      runSummary: nextRunSummary,
      saveData: currentSaveData,
      copperBreakdown,
      totalCopperBefore,
      totalCopperAfter: currentSaveData.copper,
      saveWritten: false,
      alreadyApplied: true
    };
  }

  const nextSaveData = applySummaryToSave(currentSaveData, nextRunSummary, copperBreakdown.copperEarned);
  const saveWritten = saveSystem.write(nextSaveData);
  eventBus.emit("run_result_calculated", {
    runId: nextRunSummary.runId,
    result: nextRunSummary.result,
    survivalSeconds: nextRunSummary.survivalSeconds,
    kills: nextRunSummary.kills,
    level: nextRunSummary.level,
    bossDefeated: nextRunSummary.bossDefeated,
    copperEarned: nextRunSummary.copperEarned,
    baseCopper: copperBreakdown.baseCopper,
    bossBonus: copperBreakdown.bossBonus,
    alreadyApplied: false,
    saveWritten
  });

  if (!saveWritten) {
    const failedRunSummary = {
      ...nextRunSummary,
      copperEarned: 0
    };
    setRunSummary(scene, failedRunSummary);
    return {
      runSummary: failedRunSummary,
      saveData: currentSaveData,
      copperBreakdown: {
        ...copperBreakdown,
        copperEarned: 0
      },
      totalCopperBefore,
      totalCopperAfter: currentSaveData.copper,
      saveWritten: false,
      alreadyApplied: false
    };
  }

  setSaveData(scene, nextSaveData);
  setRunSummary(scene, nextRunSummary);
  rememberSettledRunId(scene, nextRunSummary.runId);

  if (copperBreakdown.copperEarned > 0) {
    eventBus.emit("copper_gained", {
      runId: nextRunSummary.runId,
      amount: copperBreakdown.copperEarned,
      totalCopper: nextSaveData.copper
    });
    playSfxSafely(scene, "copper_gain");
  }

  return {
    runSummary: nextRunSummary,
    saveData: nextSaveData,
    copperBreakdown,
    totalCopperBefore,
    totalCopperAfter: nextSaveData.copper,
    saveWritten: true,
    alreadyApplied: false
  };
}

function applySummaryToSave(saveData: SaveData, runSummary: RunSummary, copperEarned: number): SaveData {
  const shouldRecordRunStats = runSummary.result === "dead" || runSummary.result === "win";
  return {
    ...saveData,
    copper: saveData.copper + copperEarned,
    bestTimeSeconds: shouldRecordRunStats ? Math.max(saveData.bestTimeSeconds, runSummary.survivalSeconds) : saveData.bestTimeSeconds,
    bestKills: shouldRecordRunStats ? Math.max(saveData.bestKills, runSummary.kills) : saveData.bestKills,
    bestLevel: shouldRecordRunStats ? Math.max(saveData.bestLevel, runSummary.level) : saveData.bestLevel,
    bossDefeated: shouldRecordRunStats ? saveData.bossDefeated || runSummary.bossDefeated : saveData.bossDefeated,
    metaUpgrades: { ...saveData.metaUpgrades },
    scriptureGacha: {
      starter_scripture_pool: {
        ...saveData.scriptureGacha.starter_scripture_pool
      }
    },
    collection: {
      skins: [...saveData.collection.skins],
      titles: [...saveData.collection.titles],
      fragments: { ...saveData.collection.fragments }
    },
    settings: { ...saveData.settings }
  };
}

function normalizeRunSummary(summary: RunSummary): RunSummary {
  const normalized: RunSummary = {
    runId: readRunId(summary.runId),
    result: readResultKind(summary.result),
    survivalSeconds: readNonNegativeInteger(summary.survivalSeconds),
    kills: readNonNegativeInteger(summary.kills),
    level: Math.max(1, readNonNegativeInteger(summary.level)),
    copperEarned: readNonNegativeInteger(summary.copperEarned),
    bossDefeated: Boolean(summary.bossDefeated),
    deathCause: summary.deathCause
  };
  // QA-002：bossId 透传（字段由其他代理补入 types.ts；未补前按可选字段防御性保留）
  const bossId = readSummaryBossId(summary);
  if (bossId) {
    (normalized as RunSummary & { bossId?: BossId }).bossId = bossId;
  }
  return normalized;
}

function readRunId(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return `result_fallback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readResultKind(result: unknown): RunResultKind {
  return result === "dead" || result === "win" || result === "debug" ? result : "debug";
}

function getSettledRunIds(scene: Phaser.Scene): string[] {
  const value = scene.registry.get(SETTLED_RUN_IDS_KEY);
  return Array.isArray(value) ? value.filter((runId): runId is string => typeof runId === "string") : [];
}

function rememberSettledRunId(scene: Phaser.Scene, runId: string): void {
  const nextRunIds = [...getSettledRunIds(scene), runId].slice(-20);
  scene.registry.set(SETTLED_RUN_IDS_KEY, nextRunIds);
}

function readNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

/** 防御性音频调用：AudioSystem 未注册或方法缺失时静默跳过。 */
function playSfxSafely(scene: Phaser.Scene, eventId: string): void {
  const audioSystem = scene.registry.get("audioSystem") as { playPlaceholder?: (id: string) => boolean } | undefined;
  audioSystem?.playPlaceholder?.(eventId);
}
