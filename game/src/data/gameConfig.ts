import type { DebugConfig, StageConfig } from "../types";

export const stageConfig: StageConfig = {
  id: "qingshi_mountain_road",
  displayName: "青石山道",
  targetDurationSeconds: 480,
  bossSpawnSeconds: 360,
  backgroundChunkSizePx: 1024,
  loadedChunkCount: 1,
  qualityScale: 1
};

export const debugConfig: DebugConfig = {
  eventHistoryLimit: 200,
  debugPanelDefaultVisible: false
};
