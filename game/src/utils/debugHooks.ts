import type { ConfigLoadResult, DebugSnapshot, EventHistoryEntry, SaveData, ScreenState } from "../types";
import {
  getLatestAudioDebugSnapshot,
  playLatestAudioDebugEvent,
  updateLatestAudioDebugSettings,
  type AudioDebugSnapshot
} from "../systems/AudioSystem";
import { configSystem } from "../systems/ConfigSystem";
import { eventBus } from "./EventBus";

export type BrowserDebugApi = {
  getConfigLoadResult: () => ConfigLoadResult;
  getDebugSnapshot: () => DebugSnapshot | undefined;
  getSaveData: () => SaveData | undefined;
  getEventHistory: () => EventHistoryEntry[];
  clearEventHistory: () => void;
  getAudioDebugSnapshot: () => AudioDebugSnapshot | undefined;
  playAudioEvent: (eventId: string) => boolean;
  setAudioSettings: (settings: Partial<SaveData["settings"]>) => AudioDebugSnapshot | undefined;
};

let latestDebugSnapshot: DebugSnapshot | undefined;
let latestSaveData: SaveData | undefined;

export function setLatestDebugSnapshot(snapshot: DebugSnapshot): void {
  latestDebugSnapshot = cloneDebugSnapshot(snapshot);
}

export function setLatestDebugScreenState(screenState: ScreenState): void {
  if (!latestDebugSnapshot) {
    return;
  }

  latestDebugSnapshot = {
    ...latestDebugSnapshot,
    screenState
  };
}

export function setLatestSaveData(saveData: SaveData): void {
  latestSaveData = cloneSaveData(saveData);
}

export function installDebugHooks(): void {
  window.__WUXIA_SURVIVOR_DEBUG__ = {
    getConfigLoadResult: () => configSystem.getLoadResult(),
    getDebugSnapshot: () => latestDebugSnapshot ? cloneDebugSnapshot(latestDebugSnapshot) : undefined,
    getSaveData: () => latestSaveData ? cloneSaveData(latestSaveData) : undefined,
    getEventHistory: () => eventBus.getHistory(),
    clearEventHistory: () => eventBus.clearHistory(),
    getAudioDebugSnapshot: () => getLatestAudioDebugSnapshot(),
    playAudioEvent: (eventId: string) => playLatestAudioDebugEvent(eventId),
    setAudioSettings: (settings: Partial<SaveData["settings"]>) => updateLatestAudioDebugSettings(settings)
  };
}

declare global {
  interface Window {
    __WUXIA_SURVIVOR_DEBUG__?: BrowserDebugApi;
  }
}

function cloneDebugSnapshot(snapshot: DebugSnapshot): DebugSnapshot {
  return {
    ...snapshot,
    enemiesAliveByType: { ...snapshot.enemiesAliveByType }
  };
}

function cloneSaveData(saveData: SaveData): SaveData {
  return {
    ...saveData,
    metaUpgrades: { ...saveData.metaUpgrades },
    scriptureGacha: {
      starter_scripture_pool: { ...saveData.scriptureGacha.starter_scripture_pool }
    },
    collection: {
      skins: [...saveData.collection.skins],
      titles: [...saveData.collection.titles],
      fragments: { ...saveData.collection.fragments }
    },
    settings: { ...saveData.settings }
  };
}
