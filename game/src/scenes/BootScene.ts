import Phaser from "phaser";
import { configSystem } from "../systems/ConfigSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { saveSystem } from "../systems/SaveSystem";
import { applyResolutionCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import { FONT_MONO, FONT_TITLE, PALETTE } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { preloadArtAssets, registerArtAnimations } from "../utils/artAssets";
import { installDebugHooks } from "../utils/debugHooks";
import { setConfigLoadResult, setSaveData } from "../utils/registry";
import { SCENE_KEYS } from "./sceneKeys";

const BOOT_BAR_WIDTH = 420;
const BOOT_BAR_HEIGHT = 14;

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    // 加载屏建在 preload：高清相机必须最先接入（setZoom(K) + centerOn 设计中心）
    applyResolutionCamera(this);
    this.createLoadingScreen();
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

    // 等 Web 字体就绪再进主菜单，避免标题先用回退字体渲染后跳变
    const startMenu = (): void => {
      this.scene.start(SCENE_KEYS.menu);
    };
    const fontSet = typeof document === "undefined" ? undefined : document.fonts;
    if (fontSet?.ready) {
      void fontSet.ready.then(startMenu, startMenu);
    } else {
      startMenu();
    }
  }

  private createLoadingScreen(): void {
    const centerX = DESIGN_WIDTH / 2;
    const centerY = DESIGN_HEIGHT / 2;
    const barWidth = Math.min(BOOT_BAR_WIDTH, DESIGN_WIDTH - 120);
    const barY = centerY + 36;

    this.cameras.main.setBackgroundColor(PALETTE.worldBgInt);
    this.add.text(centerX, centerY - 52, "青石山道", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: "46px",
      fontStyle: "bold"
    }).setOrigin(0.5).setStroke("#101010", 6).setResolution(2);

    // 描金边框 + 芥金填充进度条
    this.add.rectangle(centerX, barY, barWidth, BOOT_BAR_HEIGHT)
      .setStrokeStyle(2, PALETTE.accentGold, 0.9);
    const fill = this.add.rectangle(
      centerX - (barWidth - 8) / 2,
      barY,
      barWidth - 8,
      BOOT_BAR_HEIGHT - 8,
      PALETTE.accentGold,
      1
    ).setOrigin(0, 0.5).setScale(0.001, 1);
    const percentText = this.add.text(centerX, barY + 30, "0%", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_MONO,
      fontSize: "14px"
    }).setOrigin(0.5).setResolution(2);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.setScale(Math.max(0.001, value), 1);
      percentText.setText(`${Math.round(value * 100)}%`);
    });
  }
}
