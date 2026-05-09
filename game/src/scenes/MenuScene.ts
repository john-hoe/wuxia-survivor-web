import Phaser from "phaser";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { createTextButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    enterScreen(this, "menu");

    const saveData = getSaveData(this);
    const centerX = this.scale.width / 2;

    this.add.rectangle(centerX, this.scale.height / 2, this.scale.width, this.scale.height, 0x18251f);
    createArtPanel(this, "ui_panel_menu", centerX, 318, getSafePanelWidth(this, 720), 390, 0x11140f, 0.82);
    this.add.text(centerX, 72, "青石山道", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "48px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(centerX, 196, `铜钱 ${saveData.copper}    最高时间 ${saveData.bestTimeSeconds}s    最高击杀 ${saveData.bestKills}`, {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      fontStyle: "bold"
    }).setOrigin(0.5);

    createTextButton(this, centerX, 287, "开始闯荡", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      eventBus.emit("menu_start_clicked", {});
      this.scene.start(SCENE_KEYS.game);
    }, 330, 72);

    createTextButton(this, centerX, 347, "翻阅秘籍", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.start(SCENE_KEYS.scripture, { returnTo: "menu" });
    }, 330, 64);

    createTextButton(this, centerX, 407, "设置", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.start(SCENE_KEYS.settings, { returnTo: "menu" });
    }, 330, 64);
  }
}
