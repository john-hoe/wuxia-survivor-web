import Phaser from "phaser";
import type { GameSettings } from "../types";
import { saveSystem } from "../systems/SaveSystem";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { createIconButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getSaveData, setSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type SettingsSceneData = {
  returnTo?: "menu" | "pause";
};

const SETTINGS_ROW_WIDTH = 552;
const SETTINGS_ROW_HEIGHT = 46;
const SETTINGS_LABEL_OFFSET_X = -190;
const SETTINGS_LABEL_FONT_SIZE = "18px";
const SETTINGS_VALUE_FONT_SIZE = "16px";
const SETTINGS_TOGGLE_VALUE_OFFSET_X = 70;
const SETTINGS_TOGGLE_OFFSET_X = 170;
const SETTINGS_VOLUME_VALUE_OFFSET_X = -40;
const SETTINGS_SLIDER_OFFSET_X = 150;
const SETTINGS_SLIDER_WIDTH = 210;

export class SettingsScene extends Phaser.Scene {
  private returnTo: "menu" | "pause" = "menu";
  private settings?: GameSettings;
  private controls?: Phaser.GameObjects.Container;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  init(data: SettingsSceneData): void {
    this.returnTo = data.returnTo ?? "menu";
  }

  create(): void {
    enterScreen(this, "settings");
    const saveData = getSaveData(this);
    this.settings = { ...saveData.settings };
    const centerX = this.scale.width / 2;
    const panelCenterY = this.scale.height / 2 + 16;

    this.add.rectangle(centerX, this.scale.height / 2, this.scale.width, this.scale.height, 0x0f1512, 1);
    createArtPanel(this, "ui_panel_settings", centerX, panelCenterY, getSafePanelWidth(this, 700), 500, 0x11140f, 0.92);
    this.add.text(centerX, 119, "设置", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "36px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    createIconButton(this, centerX + 272, 119, "ui_icon_back", () => this.returnBack());

    this.renderControls();
  }

  private renderControls(): void {
    this.controls?.destroy(true);
    this.controls = this.add.container(0, 0);

    this.addToggleRow("静音", "muted", 182);
    this.addToggleRow("低 VFX", "lowVfxMode", 236);
    this.addVolumeRow("主音量", "masterVolume", 290);
    this.addVolumeRow("音乐音量", "musicVolume", 344);
    this.addVolumeRow("音效音量", "sfxVolume", 398);
  }

  private addRowBackground(y: number): void {
    const centerX = this.scale.width / 2;
    const rowWidth = getSafePanelWidth(this, SETTINGS_ROW_WIDTH, 80);
    this.addToControls(this.add.rectangle(centerX, y, rowWidth, SETTINGS_ROW_HEIGHT, 0x102019, 0.78).setStrokeStyle(1, 0x6fcfb8, 0.32));
  }

  private addToggleRow(label: string, key: "muted" | "lowVfxMode", y: number): void {
    if (!this.settings) {
      return;
    }
    const centerX = this.scale.width / 2;
    this.addRowBackground(y);
    const enabled = this.settings[key];
    if (key === "muted") {
      this.addSettingIcon("ui_icon_sound", centerX - 250, y, 28, enabled ? 0.42 : 1);
      this.addSettingIcon("ui_icon_mute", centerX - 214, y, 28, enabled ? 1 : 0.42);
    } else {
      this.addSettingIcon("ui_icon_low_vfx", centerX - 234, y, 30, enabled ? 1 : 0.56);
    }
    const labelX = centerX + SETTINGS_LABEL_OFFSET_X;
    this.addToControls(this.add.text(labelX, y, label, {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: SETTINGS_LABEL_FONT_SIZE,
      fontStyle: "bold"
    }).setOrigin(0, 0.5));
    this.addToControls(this.add.text(centerX + SETTINGS_TOGGLE_VALUE_OFFSET_X, y, enabled ? "开" : "关", {
      color: enabled ? "#9df4cf" : "#b8b7a4",
      fontFamily: "system-ui, sans-serif",
      fontSize: SETTINGS_VALUE_FONT_SIZE,
      fontStyle: "bold"
    }).setOrigin(0.5));

    const textureKey = enabled ? "ui_toggle_on" : "ui_toggle_off";
    const control = this.textures.exists(textureKey)
      ? this.add.image(centerX + SETTINGS_TOGGLE_OFFSET_X, y, textureKey).setDisplaySize(76, 42)
      : this.add.rectangle(centerX + SETTINGS_TOGGLE_OFFSET_X, y, 76, 42, enabled ? 0x2f7d66 : 0x26352f, 1).setStrokeStyle(2, 0xd6c28d, 0.78);
    control.setInteractive({ useHandCursor: true });
    control.on(Phaser.Input.Events.POINTER_DOWN, () => this.updateSetting(key));
    this.addToControls(control);
  }

  private addVolumeRow(label: string, key: "masterVolume" | "musicVolume" | "sfxVolume", y: number): void {
    if (!this.settings) {
      return;
    }
    const centerX = this.scale.width / 2;
    this.addRowBackground(y);
    const trackX = centerX + SETTINGS_SLIDER_OFFSET_X;
    const trackWidth = SETTINGS_SLIDER_WIDTH;
    const value = this.settings[key];
    this.addToControls(this.add.text(centerX + SETTINGS_LABEL_OFFSET_X, y, label, {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: SETTINGS_LABEL_FONT_SIZE,
      fontStyle: "bold"
    }).setOrigin(0, 0.5));
    this.addToControls(this.add.text(centerX + SETTINGS_VOLUME_VALUE_OFFSET_X, y, value.toFixed(1), {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: SETTINGS_VALUE_FONT_SIZE
    }).setOrigin(0.5));

    this.addToControls(this.createCleanSlider(trackX, y, trackWidth, value));

    const hitArea = this.add.zone(trackX, y, trackWidth + 48, 52).setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.setVolumeFromPointer(key, pointer.x, trackX, trackWidth);
    });
    this.addToControls(hitArea);
  }

  private createCleanSlider(x: number, y: number, width: number, value: number): Phaser.GameObjects.Graphics {
    const knobX = x - width / 2 + value * width;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x06100d, 0.92);
    graphics.fillRoundedRect(x - width / 2, y - 8, width, 16, 8);
    graphics.lineStyle(2, 0xd6c28d, 0.78);
    graphics.strokeRoundedRect(x - width / 2, y - 8, width, 16, 8);
    graphics.fillStyle(0x2f7d66, 0.78);
    graphics.fillRoundedRect(x - width / 2 + 4, y - 5, Math.max(8, (width - 8) * value), 10, 5);
    graphics.lineStyle(2, 0xf7f0d0, 0.7);
    graphics.fillStyle(0xd6c28d, 1);
    graphics.fillCircle(knobX, y, 13);
    graphics.strokeCircle(knobX, y, 13);
    graphics.fillStyle(0x2f7d66, 0.96);
    graphics.fillCircle(knobX, y, 9);
    return graphics;
  }

  private addSettingIcon(textureKey: string, x: number, y: number, size: number, alpha: number): void {
    if (!this.textures.exists(textureKey)) {
      this.addToControls(this.add.rectangle(x, y, size, size, 0x102019, 1).setStrokeStyle(1, 0xd6c28d, 0.7));
      return;
    }
    this.addToControls(this.add.image(x, y, textureKey).setDisplaySize(size, size).setAlpha(alpha));
  }

  private updateSetting(key: "muted" | "lowVfxMode"): void {
    if (!this.settings) {
      return;
    }
    this.settings[key] = !this.settings[key];
    this.persistSettings();
    this.renderControls();
  }

  private setVolumeFromPointer(key: "masterVolume" | "musicVolume" | "sfxVolume", pointerX: number, trackX: number, trackWidth: number): void {
    if (!this.settings) {
      return;
    }
    const rawValue = Phaser.Math.Clamp((pointerX - (trackX - trackWidth / 2)) / trackWidth, 0, 1);
    this.settings[key] = Phaser.Math.Clamp(Number((Math.round(rawValue * 10) / 10).toFixed(1)), 0, 1);
    this.persistSettings();
    this.renderControls();
  }

  private persistSettings(): void {
    if (!this.settings) {
      return;
    }
    const saveData = saveSystem.updateSettings(this.settings, getSaveData(this));
    setSaveData(this, saveData);
    getAudioSystem(this).updateSettings(saveData.settings);
    getAudioSystem(this).playPlaceholder("ui_click");
    eventBus.emit("settings_changed", { settings: saveData.settings });
  }

  private returnBack(): void {
    getAudioSystem(this).playPlaceholder("ui_click");
    if (this.returnTo === "pause") {
      enterScreen(this, "pause");
      this.scene.stop(SCENE_KEYS.settings);
      this.scene.resume(SCENE_KEYS.pause);
      return;
    }

    this.scene.start(SCENE_KEYS.menu);
  }

  private addToControls<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.controls?.add(gameObject);
    return gameObject;
  }
}
