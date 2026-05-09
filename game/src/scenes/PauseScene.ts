import Phaser from "phaser";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { createIconButton, createTextButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.pause);
  }

  create(): void {
    enterScreen(this, "pause");
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x050705, 0.72);
    createArtPanel(this, "ui_panel_pause", this.scale.width / 2, this.scale.height / 2 + 18, getSafePanelWidth(this, 560), 464, 0x18251f, 0.96);
    this.add.text(this.scale.width / 2, 133, "暂停", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "36px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    createIconButton(this, this.scale.width / 2 + 194, 133, "ui_icon_restart", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.pause);
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.game);
    });
    createIconButton(this, this.scale.width / 2 + 250, 133, "ui_icon_home", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.pause);
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.menu);
    });

    createTextButton(this, this.scale.width / 2, 235, "继续", () => this.resumeGame(), 300, 64);
    createTextButton(this, this.scale.width / 2, 298, "重新开始", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.pause);
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.game);
    }, 300, 64);
    createTextButton(this, this.scale.width / 2, 361, "回主菜单", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.pause);
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.menu);
    }, 300, 64);
    createTextButton(this, this.scale.width / 2, 424, "设置", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.launch(SCENE_KEYS.settings, { returnTo: "pause" });
      this.scene.pause(SCENE_KEYS.pause);
    }, 300, 64);
  }

  private resumeGame(): void {
    getAudioSystem(this).playPlaceholder("pause_toggle");
    enterScreen(this, "game");
    eventBus.emit("pause_closed", {});
    this.scene.stop(SCENE_KEYS.pause);
    this.scene.resume(SCENE_KEYS.game);
  }
}
