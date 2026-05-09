import Phaser from "phaser";
import { configSystem } from "../systems/ConfigSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { saveSystem } from "../systems/SaveSystem";
import { eventBus } from "../utils/EventBus";
import { preloadArtAssets, registerArtAnimations } from "../utils/artAssets";
import { installDebugHooks } from "../utils/debugHooks";
import { setConfigLoadResult, setSaveData } from "../utils/registry";
import { SCENE_KEYS } from "./sceneKeys";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    preloadArtAssets(this);
  }

  create(): void {
    registerArtAnimations(this);

    const configLoadResult = configSystem.load();
    eventBus.setHistoryLimit(configLoadResult.config.debug.eventHistoryLimit);
    installDebugHooks();
    setConfigLoadResult(this, configLoadResult);
    eventBus.emit("config_loaded", {
      status: configLoadResult.status,
      loadedConfigIds: configLoadResult.config.loadedConfigIds,
      errors: configLoadResult.errors
    });

    const saveData = saveSystem.load();
    setSaveData(this, saveData);
    this.registry.set("audioSystem", new AudioSystem(saveData.settings));
    this.scene.start(SCENE_KEYS.menu);
  }
}
