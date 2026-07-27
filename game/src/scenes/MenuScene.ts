import Phaser from "phaser";
import { addMinimalBackdrop, addMinimalMenuRow, addMinimalTitle } from "../ui/minimalTheme";
import { FONT_BODY, fadeIn, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { getAudioSystem, getSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

const STATS_Y = 30;
const TITLE_Y = 146;
const MENU_FIRST_ROW_Y = 246;
const MENU_ROW_GAP = 64;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    enterScreen(this, "menu");

    // 菜单 BGM（与关卡同曲不同 key；AudioSystem 未实现 playMusic 时静默跳过）
    (getAudioSystem(this) as any)?.playMusic?.("music_menu");

    const saveData = getSaveData(this);
    const centerX = this.scale.width / 2;
    const screenHeight = this.scale.height;

    // 极简碑林氛围底：墨底 + 两侧竹影 + 底部雾气 + 暗角（主题模块统一负责视差漂移）
    addMinimalBackdrop(this);

    // 顶部一行极小统计字：60% 白、点分隔
    this.add.text(
      centerX,
      STATS_Y,
      `铜钱 ${saveData.copper}  ·  最高存活 ${saveData.bestTimeSeconds}s  ·  最高击杀 ${saveData.bestKills}`,
      {
        color: "rgba(255,255,255,0.6)",
        fontFamily: FONT_BODY,
        fontSize: "12px"
      }
    ).setOrigin(0.5).setResolution(2);

    // 书法标题 + 朱砂"侠"印
    addMinimalTitle(this, "青石山道", TITLE_Y, 72, "侠");

    this.createHero(centerX, screenHeight);

    const startRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y, "开始闯荡", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      eventBus.emit("menu_start_clicked", {});
      transitionTo(this, SCENE_KEYS.game);
    }, { highlight: true, fontSize: 28 });

    const scriptureRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y + MENU_ROW_GAP, "翻阅秘籍", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      transitionTo(this, SCENE_KEYS.scripture, { returnTo: "menu" });
    }, { fontSize: 28 });

    const settingsRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y + MENU_ROW_GAP * 2, "设置", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      transitionTo(this, SCENE_KEYS.settings, { returnTo: "menu" });
    }, { fontSize: 28 });

    // 行入场 stagger：alpha 0→1、y+10→0、delay index*90
    [startRow, scriptureRow, settingsRow].forEach((row, index) => {
      const targetY = row.container.y;
      row.container.setAlpha(0);
      row.container.y = targetY + 10;
      this.tweens.add({
        targets: row.container,
        alpha: 1,
        y: targetY,
        duration: 320,
        delay: index * 90,
        ease: Phaser.Math.Easing.Sine.Out
      });
    });

    this.addFullscreenButton();

    // 首次手势解锁音频（autoplay 策略），AudioSystem 若未实现则静默跳过
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      (getAudioSystem(this) as unknown as { unlockFromGesture?: () => void }).unlockFromGesture?.();
    });

    fadeIn(this);
  }

  /** 右上角全屏切换：30×30 图标按钮，hover 提亮放大；不支持全屏的环境（iOS Safari）直接隐藏。 */
  private addFullscreenButton(): void {
    if (!this.scale.fullscreen.available) {
      return;
    }
    const button = this.textures.exists("icon_fullscreen")
      ? this.add.image(this.scale.width - 30, 30, "icon_fullscreen").setDisplaySize(30, 30)
      : this.add.rectangle(this.scale.width - 30, 30, 30, 30, 0x101010, 0.6).setStrokeStyle(1, 0xa99a20, 0.8);
    const baseScale = button.scaleX;
    let restAlpha = 0.8;
    button.setAlpha(restAlpha).setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.setAlpha(1).setScale(baseScale * 1.1);
    });
    button.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.setAlpha(restAlpha).setScale(baseScale);
    });
    button.on(Phaser.Input.Events.POINTER_DOWN, () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      try {
        this.scale.toggleFullscreen();
      } catch {
        // iOS Safari 等环境下 fullscreen 请求可能被拒，静默降级
      }
    });

    const onEnterFullscreen = (): void => {
      restAlpha = 0.5;
      button.setAlpha(restAlpha);
      console.info("[MenuScene] 已进入全屏");
    };
    const onLeaveFullscreen = (): void => {
      restAlpha = 0.8;
      button.setAlpha(restAlpha);
    };
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, onEnterFullscreen);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, onLeaveFullscreen);
    // ScaleManager 跨场景存活，场景关闭时摘除监听避免泄漏
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, onEnterFullscreen);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, onLeaveFullscreen);
    });
  }

  /** 少侠待机：居中下方漂浮（纹理/动画存在才启用），底部垫一团墨影。 */
  private createHero(centerX: number, screenHeight: number): void {
    if (!this.textures.exists("hero_shaoxia_idle")) {
      return;
    }
    // 墨影：径向渐变近似——压扁的半透明黑椭圆
    this.add.ellipse(centerX, screenHeight - 8, 96, 14, 0x000000, 0.35);

    const heroY = screenHeight - 48;
    const hero = this.add.sprite(centerX, heroY, "hero_shaoxia_idle").setScale(0.7);
    const idleAnimKey = getArtAnimationKey("hero_shaoxia_idle");
    if (this.anims.exists(idleAnimKey)) {
      hero.play(idleAnimKey);
    }
    this.tweens.add({
      targets: hero,
      y: heroY - 8,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut
    });
  }
}
