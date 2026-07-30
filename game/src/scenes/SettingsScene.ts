import Phaser from "phaser";
import { feedbackSettingsDefaults, shakeScaleLevels } from "../data/gameConfig";
import type { GameSettings } from "../types";
import { saveSystem } from "../systems/SaveSystem";
import { applyResolutionCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import { addMinimalBackdrop, addMinimalBackRow, addMinimalTitle, spacedText } from "../ui/minimalTheme";
import { FONT_MONO, PALETTE, fadeIn, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { setAccessibleActions } from "../utils/accessibility";
import { getAudioSystem, getSaveData, setSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type SettingsSceneData = {
  returnTo?: "menu" | "pause";
};

type VolumeKey = "masterVolume" | "musicVolume" | "sfxVolume";
type ToggleKey = "muted" | "lowVfxMode" | "damageNumbers";

type SliderRefs = {
  graphics: Phaser.GameObjects.Graphics;
  valueText: Phaser.GameObjects.Text;
  trackX: number;
  trackY: number;
  trackWidth: number;
};

type ToggleRefs = {
  capsule: Phaser.GameObjects.Graphics;
  knob: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
};

/** 震屏强度三档分段控件引用：三个小字选项 + 一条选中下划线。 */
type ShakeSegmentRefs = {
  optionTexts: Phaser.GameObjects.Text[];
  underline: Phaser.GameObjects.Graphics;
  centersX: number[];
  y: number;
};

/**
 * 方向 C「极简碑林」：去面板化，内容浮于氛围底之上。
 * 氛围底 / 书法标题 / 左下返回行由共享 minimalTheme 模块统一绘制；
 * 本场景只保留滑杆 / 胶囊开关 / 三档分段三个自绘控件（按 C 规格重画），
 * 行区 540 宽居中，行高 54（7 行纵向节奏，底部避让返回行），图标 20×20 置于标签左侧。
 */
const TITLE_Y = 58;
const FIRST_ROW_Y = 132;
const ROW_HEIGHT = 48;
const ROW_LABEL_OFFSET_X = -270;
const ROW_LABEL_FONT_SIZE = "16px";
const ROW_LABEL_FONT = "'Noto Serif SC', 'Songti SC', 'SimSun', serif";
const ROW_ICON_SIZE = 20;
const ROW_ICON_GAP = 8;
const SLIDER_CENTER_OFFSET_X = 86;
const SLIDER_WIDTH = 248;
const SLIDER_KNOB_RADIUS = 7;
const SLIDER_VALUE_OFFSET_X = 228;
const SLIDER_VALUE_FONT_SIZE = "13px";
const TOGGLE_CENTER_OFFSET_X = 250;
const TOGGLE_WIDTH = 40;
const TOGGLE_HEIGHT = 20;
const TOGGLE_INSET = 3;
const TOGGLE_KNOB_RADIUS = 7;
const TOGGLE_KNOB_TRAVEL = TOGGLE_WIDTH / 2 - TOGGLE_INSET - TOGGLE_KNOB_RADIUS;
const TOGGLE_SLIDE_MS = 100;
const SEGMENT_FONT_SIZE = "13px";
const SEGMENT_OPTION_WIDTH = 56;
const SEGMENT_GROUP_RIGHT_OFFSET_X = 270;
const SEGMENT_UNDERLINE_WIDTH = 20;
const SEGMENT_UNDERLINE_OFFSET_Y = 13;
const SEGMENT_HIT_HEIGHT = 36;
const SHAKE_OPTION_LABELS = ["无", "弱", "标准"] as const;
const CONTENT_FADE_MS = 120;

export class SettingsScene extends Phaser.Scene {
  private returnTo: "menu" | "pause" = "menu";
  private settings?: GameSettings;
  private controls?: Phaser.GameObjects.Container;
  private sliders: Partial<Record<VolumeKey, SliderRefs>> = {};
  private toggles: Partial<Record<ToggleKey, ToggleRefs>> = {};
  private fullscreenToggle?: ToggleRefs;
  private shakeSegments?: ShakeSegmentRefs;
  private activeSliderKey?: VolumeKey;
  private persistenceStatusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  init(data: SettingsSceneData): void {
    this.returnTo = data.returnTo ?? "menu";
  }

  create(): void {
    applyResolutionCamera(this);
    enterScreen(this, "settings");
    const saveData = getSaveData(this);
    this.settings = { ...saveData.settings };
    const centerX = DESIGN_WIDTH / 2;
    const centerY = DESIGN_HEIGHT / 2;

    // 墨底压暗 + 共享氛围底（竹丛/远亭/雾气/暗角），无面板
    this.add.rectangle(centerX, centerY, DESIGN_WIDTH, DESIGN_HEIGHT, 0x050705, 0.66);
    addMinimalBackdrop(this);
    addMinimalTitle(this, "设置", TITLE_Y, 46, "设");

    // 滑杆拖拽：DOWN 命中行后由场景级 MOVE/UP 持续驱动
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handleSliderDrag, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.endSliderDrag, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.endSliderDrag, this);
    // 全屏事件来自系统级 ScaleManager，场景关闭时必须摘除
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenToggle, this);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenToggle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handleSliderDrag, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.endSliderDrag, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.endSliderDrag, this);
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenToggle, this);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenToggle, this);
    });

    this.renderControls();
    this.persistenceStatusText = this.add
      .text(DESIGN_WIDTH / 2, DESIGN_HEIGHT - 26, "", {
        color: "#efb08c",
        fontFamily: ROW_LABEL_FONT,
        fontSize: "13px"
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setAlpha(0.92);
    this.refreshAccessibleActions();
    fadeIn(this);
  }

  private renderControls(): void {
    this.controls?.destroy(true);
    this.sliders = {};
    this.toggles = {};
    this.fullscreenToggle = undefined;
    this.shakeSegments = undefined;
    this.activeSliderKey = undefined;
    this.controls = this.add.container(0, 0);

    this.addVolumeRow("总音量", "masterVolume", FIRST_ROW_Y, "icon_sfx");
    this.addVolumeRow("音乐", "musicVolume", FIRST_ROW_Y + ROW_HEIGHT, "icon_music");
    this.addVolumeRow("音效", "sfxVolume", FIRST_ROW_Y + ROW_HEIGHT * 2, "icon_sfx");
    this.addToggleRow("静音", "muted", FIRST_ROW_Y + ROW_HEIGHT * 3, "icon_mute");
    this.addToggleRow("低特效", "lowVfxMode", FIRST_ROW_Y + ROW_HEIGHT * 4, "icon_lowvfx");
    this.addToggleRow("伤害飘字", "damageNumbers", FIRST_ROW_Y + ROW_HEIGHT * 5, "icon_kill");
    this.addShakeScaleRow(FIRST_ROW_Y + ROW_HEIGHT * 6, "icon_sfx");
    this.addFullscreenRow(FIRST_ROW_Y + ROW_HEIGHT * 7);

    // C 规格：左下角「← 返回」（语义不变：menu 来→transitionTo menu；pause 来→resume pause）
    const backRow = addMinimalBackRow(this, () => this.returnBack());
    this.controls.add(backRow.container);

    // 视图切换：content 容器 120ms 淡入
    this.controls.setAlpha(0);
    this.tweens.add({
      targets: this.controls,
      alpha: 1,
      duration: CONTENT_FADE_MS,
      ease: Phaser.Math.Easing.Linear
    });
  }

  /** 行图标：20×20 摆在标签左侧 8px 处；纹理缺失（并行代理未就绪）时不显示。 */
  private addRowIcon(iconKey: string | undefined, y: number): void {
    if (!iconKey || !this.textures.exists(iconKey)) {
      return;
    }
    const centerX = DESIGN_WIDTH / 2;
    const iconX = centerX + ROW_LABEL_OFFSET_X - ROW_ICON_GAP - ROW_ICON_SIZE / 2;
    this.addToControls(this.add.image(iconX, y, iconKey).setDisplaySize(ROW_ICON_SIZE, ROW_ICON_SIZE));
  }

  /** C 规格行标签：衬线 600 + \u2009 大字距（spacedText），米白 92%。 */
  private addRowLabel(label: string, y: number, iconKey?: string): Phaser.GameObjects.Text {
    this.addRowIcon(iconKey, y);
    const centerX = DESIGN_WIDTH / 2;
    return this.addToControls(
      this.add
        .text(centerX + ROW_LABEL_OFFSET_X, y, spacedText(label), {
          color: "#f0ead8",
          fontFamily: ROW_LABEL_FONT,
          fontSize: ROW_LABEL_FONT_SIZE,
          // Phaser TextStyle 无 fontWeight 字段；fontStyle 会拼进 CSS font shorthand，"600" 即字重
          fontStyle: "600"
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.92)
        .setShadow(0, 1, "rgba(0,0,0,0.5)", 3)
        .setResolution(2)
    );
  }

  private addToggleRow(label: string, key: ToggleKey, y: number, iconKey?: string): void {
    if (!this.settings) {
      return;
    }
    const centerX = DESIGN_WIDTH / 2;
    const toggleX = centerX + TOGGLE_CENTER_OFFSET_X;
    this.addRowLabel(label, y, iconKey);

    // C 规格极简双线胶囊开关：40×20，白线框，on 玉色实钮居右 / off 空心钮居左
    const capsule = this.add.graphics();
    const knob = this.add.graphics();
    const refs: ToggleRefs = { capsule, knob, x: toggleX, y };
    this.toggles[key] = refs;
    this.addToControls(capsule);
    this.addToControls(knob);
    this.drawToggleCapsule(refs);
    this.drawToggleKnob(refs, this.settings[key]);

    const hitArea = this.add.zone(toggleX, y, 72, 72).setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => this.updateSetting(key));
    this.addToControls(hitArea);
  }

  /** C 规格双线胶囊：外框 1px 白 40% + 内框 inset 3px 1px 白 12%；不随 on/off 变色。 */
  private drawToggleCapsule(refs: ToggleRefs): void {
    refs.capsule.clear();
    refs.capsule.lineStyle(1, 0xffffff, 0.4);
    refs.capsule.strokeRoundedRect(
      refs.x - TOGGLE_WIDTH / 2,
      refs.y - TOGGLE_HEIGHT / 2,
      TOGGLE_WIDTH,
      TOGGLE_HEIGHT,
      TOGGLE_HEIGHT / 2
    );
    refs.capsule.lineStyle(1, 0xffffff, 0.12);
    refs.capsule.strokeRoundedRect(
      refs.x - TOGGLE_WIDTH / 2 + TOGGLE_INSET,
      refs.y - TOGGLE_HEIGHT / 2 + TOGGLE_INSET,
      TOGGLE_WIDTH - TOGGLE_INSET * 2,
      TOGGLE_HEIGHT - TOGGLE_INSET * 2,
      (TOGGLE_HEIGHT - TOGGLE_INSET * 2) / 2
    );
  }

  /** C 规格胶囊钮：on = 玉色实心（PALETTE.hp + 微光晕），off = 1px 白 50% 空心。 */
  private paintToggleKnob(refs: ToggleRefs, on: boolean): void {
    refs.knob.clear();
    if (on) {
      refs.knob.fillStyle(PALETTE.hp, 0.22);
      refs.knob.fillCircle(0, 0, TOGGLE_KNOB_RADIUS + 3);
      refs.knob.fillStyle(PALETTE.hp, 1);
      refs.knob.fillCircle(0, 0, TOGGLE_KNOB_RADIUS);
      return;
    }
    refs.knob.lineStyle(1, 0xffffff, 0.5);
    refs.knob.strokeCircle(0, 0, TOGGLE_KNOB_RADIUS);
  }

  private drawToggleKnob(refs: ToggleRefs, on: boolean): void {
    this.paintToggleKnob(refs, on);
    refs.knob.setPosition(refs.x + (on ? TOGGLE_KNOB_TRAVEL : -TOGGLE_KNOB_TRAVEL), refs.y);
  }

  /** 切换后原位刷新：胶囊重绘 + 滑钮 100ms 滑动 Tween。 */
  private refreshToggle(key: ToggleKey): void {
    const refs = this.toggles[key];
    if (!refs || !this.settings) {
      return;
    }
    const on = this.settings[key];
    this.drawToggleCapsule(refs);
    this.slideToggleKnob(refs, on);
  }

  /** 胶囊开关 knob 滑动 Tween（静音/低特效/伤害飘字/全屏共用），100ms 不变。 */
  private slideToggleKnob(refs: ToggleRefs, on: boolean): void {
    this.paintToggleKnob(refs, on);
    const targetX = refs.x + (on ? TOGGLE_KNOB_TRAVEL : -TOGGLE_KNOB_TRAVEL);
    this.tweens.killTweensOf(refs.knob);
    this.tweens.add({
      targets: refs.knob,
      x: targetX,
      duration: TOGGLE_SLIDE_MS,
      ease: Phaser.Math.Easing.Quadratic.Out
    });
  }

  /**
   * 震屏强度三档分段行：无 / 弱 / 标准三个小字选项右对齐排布（与胶囊右缘对齐），
   * 选中者芥金 + 下划短线（C 规格极简），点击切换并随 persistSettings 落盘热更。
   */
  private addShakeScaleRow(y: number, iconKey?: string): void {
    if (!this.settings) {
      return;
    }
    const centerX = DESIGN_WIDTH / 2;
    this.addRowLabel("震屏强度", y, iconKey);

    const groupLeft = centerX + SEGMENT_GROUP_RIGHT_OFFSET_X - SEGMENT_OPTION_WIDTH * shakeScaleLevels.length;
    const centersX = shakeScaleLevels.map((_, index) => groupLeft + SEGMENT_OPTION_WIDTH * (index + 0.5));
    const underline = this.add.graphics();
    this.addToControls(underline);

    const optionTexts = shakeScaleLevels.map((level, index) => {
      const optionText = this.add
        .text(centersX[index], y, SHAKE_OPTION_LABELS[index], {
          color: "#f0ead8",
          fontFamily: ROW_LABEL_FONT,
          fontSize: SEGMENT_FONT_SIZE,
          // 与行标签同法：fontStyle "600" 拼进 CSS font shorthand 表字重
          fontStyle: "600"
        })
        .setOrigin(0.5, 0.5)
        .setResolution(2);
      this.addToControls(optionText);

      const hitArea = this.add
        .zone(centersX[index], y, Math.max(56, SEGMENT_OPTION_WIDTH - 4), Math.max(56, SEGMENT_HIT_HEIGHT))
        .setInteractive({ useHandCursor: true });
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => this.updateShakeScale(level));
      this.addToControls(hitArea);
      return optionText;
    });

    this.shakeSegments = { optionTexts, underline, centersX, y };
    this.refreshShakeSegments();
  }

  /** 点击某一档：写设置、落盘 + settings_changed 热更新，再原位刷新分段样式。 */
  private updateShakeScale(level: number): void {
    if (!this.settings || this.settings.shakeScale === level) {
      return;
    }
    this.settings.shakeScale = level;
    this.persistSettings();
    this.refreshShakeSegments();
  }

  /** 分段行原位刷新：选中项芥金 95% + 芥金短下划线，未选米白 45%。 */
  private refreshShakeSegments(): void {
    const refs = this.shakeSegments;
    if (!refs || !this.settings) {
      return;
    }
    const activeIndex = this.currentShakeScaleIndex();
    refs.optionTexts.forEach((optionText, index) => {
      const active = index === activeIndex;
      optionText.setColor(active ? PALETTE.accentGoldCss : "#f0ead8");
      optionText.setAlpha(active ? 0.95 : 0.45);
    });
    refs.underline.clear();
    const activeCenterX = refs.centersX[activeIndex];
    refs.underline.lineStyle(2, PALETTE.accentGold, 0.9);
    refs.underline.lineBetween(
      activeCenterX - SEGMENT_UNDERLINE_WIDTH / 2,
      refs.y + SEGMENT_UNDERLINE_OFFSET_Y,
      activeCenterX + SEGMENT_UNDERLINE_WIDTH / 2,
      refs.y + SEGMENT_UNDERLINE_OFFSET_Y
    );
  }

  /** 当前 shakeScale 的档序；异常值（非三档）时吸附最近档，保证分段总有选中态。 */
  private currentShakeScaleIndex(): number {
    const value = this.settings?.shakeScale ?? feedbackSettingsDefaults.shakeScale;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    shakeScaleLevels.forEach((level, index) => {
      const distance = Math.abs(value - level);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    return nearestIndex;
  }

  /**
   * 全屏开关行：样式与静音/低特效一致，状态不落盘，直接映射 ScaleManager。
   * fullscreen.available === false（如 iframe 无 allowfullscreen）时整行禁用。
   */
  private addFullscreenRow(y: number): void {
    const centerX = DESIGN_WIDTH / 2;
    const toggleX = centerX + TOGGLE_CENTER_OFFSET_X;
    const labelText = this.addRowLabel("全屏", y, "icon_fullscreen");

    const capsule = this.add.graphics();
    const knob = this.add.graphics();
    const refs: ToggleRefs = { capsule, knob, x: toggleX, y };
    this.fullscreenToggle = refs;
    this.addToControls(capsule);
    this.addToControls(knob);
    this.drawToggleCapsule(refs);
    this.drawToggleKnob(refs, this.scale.isFullscreen);

    if (this.scale.fullscreen.available === false) {
      labelText.setAlpha(0.35);
      capsule.setAlpha(0.35);
      knob.setAlpha(0.35);
      return;
    }

    const hitArea = this.add.zone(toggleX, y, 72, 72).setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      // 无头浏览器/权限被拒时会静默失败，开关态由 ENTER/LEAVE 事件回同步
      this.scale.toggleFullscreen();
    });
    this.addToControls(hitArea);
  }

  /** ENTER/LEAVE_FULLSCREEN 事件回调：按 ScaleManager 真实状态刷新开关。 */
  private syncFullscreenToggle(): void {
    const refs = this.fullscreenToggle;
    if (!refs) {
      return;
    }
    const on = this.scale.isFullscreen;
    this.drawToggleCapsule(refs);
    this.slideToggleKnob(refs, on);
  }

  private addVolumeRow(label: string, key: VolumeKey, y: number, iconKey?: string): void {
    if (!this.settings) {
      return;
    }
    const centerX = DESIGN_WIDTH / 2;
    const trackX = centerX + SLIDER_CENTER_OFFSET_X;
    const trackWidth = SLIDER_WIDTH;
    const value = this.settings[key];
    this.addRowLabel(label, y, iconKey);
    const valueText = this.add
      .text(centerX + SLIDER_VALUE_OFFSET_X, y, value.toFixed(1), {
        color: "#ffffff",
        fontFamily: FONT_MONO,
        fontSize: SLIDER_VALUE_FONT_SIZE
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.62)
      .setResolution(2);
    this.addToControls(valueText);

    const graphics = this.add.graphics();
    this.drawSlider(graphics, trackX, y, trackWidth, value);
    this.addToControls(graphics);
    this.sliders[key] = { graphics, valueText, trackX, trackY: y, trackWidth };

    const hitArea = this.add.zone(trackX, y, trackWidth + 36, 72).setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.activeSliderKey = key;
      // 高 DPR：滑杆几何为设计单位，pointer.x 是 K 倍渲染像素，须取相机变换后的 worldX
      this.applyPointerVolume(key, pointer.worldX);
    });
    this.addToControls(hitArea);
  }

  /**
   * 重绘单个滑杆（clear 后按当前值重画轨道/填充/knob），不整页重建。
   * C 规格：2px 白 30% 细轨 + 2px 白 70% 填充段 + 玉色圆钮（半径 7，PALETTE.hp + 金边）。
   */
  private drawSlider(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, value: number): void {
    const left = x - width / 2;
    const knobX = left + width * value;
    graphics.clear();
    // 细轨：2px 白 30%
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRect(left, y - 1, width, 2);
    // 填充段：2px 白 70%
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillRect(left, y - 1, width * value, 2);
    // 玉色圆钮：PALETTE.hp 填充 + 金描边（附微光晕）
    graphics.fillStyle(PALETTE.hp, 0.22);
    graphics.fillCircle(knobX, y, SLIDER_KNOB_RADIUS + 3);
    graphics.fillStyle(PALETTE.hp, 1);
    graphics.fillCircle(knobX, y, SLIDER_KNOB_RADIUS);
    graphics.lineStyle(1, PALETTE.legacyGold, 0.9);
    graphics.strokeCircle(knobX, y, SLIDER_KNOB_RADIUS);
  }

  private handleSliderDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSliderKey || !pointer.isDown) {
      return;
    }
    // 高 DPR：同 POINTER_DOWN，worldX 才是设计单位坐标
    this.applyPointerVolume(this.activeSliderKey, pointer.worldX);
  }

  private endSliderDrag(): void {
    this.activeSliderKey = undefined;
  }

  private applyPointerVolume(key: VolumeKey, pointerX: number): void {
    const slider = this.sliders[key];
    if (!this.settings || !slider) {
      return;
    }
    const rawValue = Phaser.Math.Clamp((pointerX - (slider.trackX - slider.trackWidth / 2)) / slider.trackWidth, 0, 1);
    const nextValue = Phaser.Math.Clamp(Number((Math.round(rawValue * 10) / 10).toFixed(1)), 0, 1);
    if (this.settings[key] === nextValue) {
      return;
    }
    this.settings[key] = nextValue;
    this.persistSettings(false);
    this.drawSlider(slider.graphics, slider.trackX, slider.trackY, slider.trackWidth, nextValue);
    slider.valueText.setText(nextValue.toFixed(1));
  }

  private updateSetting(key: ToggleKey): void {
    if (!this.settings) {
      return;
    }
    this.settings[key] = !this.settings[key];
    this.persistSettings();
    this.refreshToggle(key);
  }

  private persistSettings(playClick = true): void {
    if (!this.settings) {
      return;
    }
    const updateResult = saveSystem.updateSettings(this.settings, getSaveData(this));
    setSaveData(this, updateResult.saveData);
    getAudioSystem(this).updateSettings(updateResult.saveData.settings);
    this.persistenceStatusText?.setText(
      updateResult.written ? "" : "设置仅本次生效，本地存档当前不可写"
    );
    if (playClick) {
      getAudioSystem(this).playPlaceholder("ui_click");
    }
    eventBus.emit("settings_changed", {
      settings: updateResult.saveData.settings,
      persisted: updateResult.written
    });
    this.refreshAccessibleActions();
  }

  private refreshAccessibleActions(): void {
    if (!this.settings) {
      return;
    }
    const adjustVolume = (key: VolumeKey, delta: number): void => {
      if (!this.settings) {
        return;
      }
      this.settings[key] = Phaser.Math.Clamp(Number((this.settings[key] + delta).toFixed(1)), 0, 1);
      this.persistSettings(false);
      this.renderControls();
    };
    setAccessibleActions(this, "设置", [
      { label: `总音量 ${this.settings.masterVolume}，降低`, onActivate: () => adjustVolume("masterVolume", -0.1) },
      { label: `总音量 ${this.settings.masterVolume}，提高`, onActivate: () => adjustVolume("masterVolume", 0.1) },
      { label: `音乐音量 ${this.settings.musicVolume}，降低`, onActivate: () => adjustVolume("musicVolume", -0.1) },
      { label: `音乐音量 ${this.settings.musicVolume}，提高`, onActivate: () => adjustVolume("musicVolume", 0.1) },
      { label: `音效音量 ${this.settings.sfxVolume}，降低`, onActivate: () => adjustVolume("sfxVolume", -0.1) },
      { label: `音效音量 ${this.settings.sfxVolume}，提高`, onActivate: () => adjustVolume("sfxVolume", 0.1) },
      { label: `静音，当前${this.settings.muted ? "开启" : "关闭"}`, onActivate: () => this.updateSetting("muted") },
      { label: `低特效，当前${this.settings.lowVfxMode ? "开启" : "关闭"}`, onActivate: () => this.updateSetting("lowVfxMode") },
      { label: `伤害飘字，当前${this.settings.damageNumbers ? "开启" : "关闭"}`, onActivate: () => this.updateSetting("damageNumbers") },
      {
        label: `震屏强度 ${this.settings.shakeScale}`,
        onActivate: () => {
          const index = this.currentShakeScaleIndex();
          this.updateShakeScale(shakeScaleLevels[(index + 1) % shakeScaleLevels.length]);
        }
      },
      { label: "返回", onActivate: () => this.returnBack() }
    ], "可用按钮逐项调整音量和视觉反馈。");
  }

  private returnBack(): void {
    getAudioSystem(this).playPlaceholder("ui_click");
    if (this.returnTo === "pause") {
      enterScreen(this, "pause");
      this.scene.stop(SCENE_KEYS.settings);
      this.scene.resume(SCENE_KEYS.pause);
      return;
    }

    transitionTo(this, SCENE_KEYS.menu);
  }

  private addToControls<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.controls?.add(gameObject);
    return gameObject;
  }
}
