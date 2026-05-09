import Phaser from "phaser";
import type { ConfigLoadResult, RunSummary, ScreenState, SaveData } from "../types";
import { AudioSystem } from "../systems/AudioSystem";
import { setLatestSaveData } from "./debugHooks";

export function setScreenState(scene: Phaser.Scene, screenState: ScreenState): void {
  scene.registry.set("screenState", screenState);
}

export function prepareScreenTransition(scene: Phaser.Scene, screenState: ScreenState): void {
  scene.registry.set("pendingPreviousScreenState", getScreenState(scene));
  setScreenState(scene, screenState);
}

export function consumePendingPreviousScreenState(scene: Phaser.Scene): ScreenState | undefined {
  const previousScreenState = scene.registry.get("pendingPreviousScreenState") as ScreenState | undefined;
  scene.registry.remove("pendingPreviousScreenState");
  return previousScreenState;
}

export function getScreenState(scene: Phaser.Scene): ScreenState {
  return (scene.registry.get("screenState") as ScreenState | undefined) ?? "menu";
}

export function getSaveData(scene: Phaser.Scene): SaveData {
  const saveData = scene.registry.get("saveData") as SaveData | undefined;
  if (!saveData) {
    throw new Error("Save data not initialized");
  }
  return saveData;
}

export function setSaveData(scene: Phaser.Scene, saveData: SaveData): void {
  scene.registry.set("saveData", saveData);
  setLatestSaveData(saveData);
}

export function setConfigLoadResult(scene: Phaser.Scene, configLoadResult: ConfigLoadResult): void {
  scene.registry.set("configLoadResult", configLoadResult);
}

export function getConfigLoadResult(scene: Phaser.Scene): ConfigLoadResult {
  const configLoadResult = scene.registry.get("configLoadResult") as ConfigLoadResult | undefined;
  if (!configLoadResult) {
    throw new Error("Game config not initialized");
  }
  return configLoadResult;
}

export function setRunSummary(scene: Phaser.Scene, runSummary: RunSummary): void {
  scene.registry.set("runSummary", runSummary);
}

export function getRunSummary(scene: Phaser.Scene): RunSummary {
  return (scene.registry.get("runSummary") as RunSummary | undefined) ?? {
    runId: "registry_default_run",
    result: "debug",
    survivalSeconds: 0,
    kills: 0,
    level: 1,
    copperEarned: 0,
    bossDefeated: false
  };
}

export function getAudioSystem(scene: Phaser.Scene): AudioSystem {
  const audioSystem = scene.registry.get("audioSystem") as AudioSystem | undefined;
  if (!audioSystem) {
    throw new Error("Audio system not initialized");
  }
  return audioSystem;
}
