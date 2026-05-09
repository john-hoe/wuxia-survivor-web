import Phaser from "phaser";
import type { ScreenState } from "../types";
import { eventBus } from "./EventBus";
import { setLatestDebugScreenState } from "./debugHooks";
import { consumePendingPreviousScreenState, getScreenState, setScreenState } from "./registry";

export function enterScreen(scene: Phaser.Scene, screenState: ScreenState): void {
  const previousScreenState = consumePendingPreviousScreenState(scene) ?? getScreenState(scene);
  setScreenState(scene, screenState);
  setLatestDebugScreenState(screenState);
  eventBus.emit("screen_changed", { previousScreenState, screenState });
}
