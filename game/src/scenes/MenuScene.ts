import Phaser from "phaser";
import { stageMapConfig } from "../data/gameConfig";
import type { StageMapId } from "../data/gameConfig";
import { saveSystem } from "../systems/SaveSystem";
import { addMinimalBackdrop, addMinimalMenuRow, addMinimalTitle, spacedText, type MinimalRowHandle } from "../ui/minimalTheme";
import { FONT_BODY, PALETTE, fadeIn, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { getAudioSystem, getSaveData, setSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import type { SaveData } from "../types";
import { SCENE_KEYS } from "./sceneKeys";

const STATS_Y = 30;
const TITLE_Y = 146;
const MENU_FIRST_ROW_Y = 246;
const MENU_ROW_GAP = 64;
/** 选关行紧跟"开始闯荡"，弱化行距更紧凑 */
const MAP_ROW_GAP = 50;
/** QA-004：◀ ▶ 箭头与选关行文字边缘的间距（px，容器局部坐标） */
const MAP_ARROW_GAP = 44;
/** QA-004：行尾页码与 ▶ 箭头的间距（px） */
const MAP_PAGE_GAP = 34;
/** QA-004：行下"点击切换"提示的纵向偏移（px） */
const MAP_HINT_OFFSET_Y = 30;
/** QA-004：标题下"当前关卡 · X"联动行的 y 坐标 */
const CURRENT_MAP_LABEL_Y = TITLE_Y + 54;

export class MenuScene extends Phaser.Scene {
  /** 选关行的文字对象（addMinimalMenuRow 容器第 0 个元素），切换时行内更新。 */
  private mapRowText?: Phaser.GameObjects.Text;
  /** QA-004：选关行 ◀ ▶ 切换箭头（挂在选关行容器内，随入场 stagger 一起淡入）。 */
  private mapArrowLeft?: Phaser.GameObjects.Text;
  private mapArrowRight?: Phaser.GameObjects.Text;
  /** QA-004：行尾页码（1/3、2/3、3/3）。 */
  private mapPageText?: Phaser.GameObjects.Text;
  /** QA-004：标题下"当前关卡 · X"联动行（13px 芥金）。 */
  private currentMapText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    enterScreen(this, "menu");

    // QA-006：注入"当前选关地图 id"解析器（闭包读全局 registry 存档，场景关闭后仍有效）；
    // AudioSystem 据此把 GameScene 旧版硬编码的关卡 BGM 请求重映射到该图 musicId。
    getAudioSystem(this).setStageMapIdResolver(() => {
      try {
        return this.readSelectedMapId(getSaveData(this));
      } catch {
        return undefined;
      }
    });
    // QA-010：菜单 BGM 不随 create 立即播放，延迟到首次可信手势解锁后（见底部 POINTER_DOWN）

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

    // 书法标题 + 朱砂"侠"印（"青石山道"保留为产品名，不随选关变化）
    addMinimalTitle(this, "青石山道", TITLE_Y, 72, "侠");

    // QA-004：标题下常驻"当前关卡 · X"（13px 芥金），与选关行联动
    this.currentMapText = this.add.text(centerX, CURRENT_MAP_LABEL_Y, "", {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0.5).setResolution(2).setAlpha(0.9);

    this.createHero(centerX, screenHeight);

    const startRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y, "开始闯荡", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      eventBus.emit("menu_start_clicked", {});
      transitionTo(this, SCENE_KEYS.game);
    }, { highlight: true, fontSize: 28 });

    // 选关行（弱化小字）：读存档显示当前选，点击按 stageMapConfig.maps 顺序循环（三图）并写存档
    const selectedMapId = this.readSelectedMapId(saveData);
    const selectedMap = stageMapConfig.maps.find((entry) => entry.id === selectedMapId) ?? stageMapConfig.maps[0];
    const mapRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y + MAP_ROW_GAP, `关卡 · ${selectedMap.displayName}`, () => {
      this.cycleMapSelection();
    }, { fontSize: 20 });
    this.mapRowText = mapRow.container.getAt(0) as Phaser.GameObjects.Text;
    // QA-004：◀ ▶ 可点击箭头 + 行尾页码 + 行下"点击切换"提示（挂入选关行容器，随入场动画淡入）
    this.addMapRowChrome(mapRow);

    const scriptureRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y + MAP_ROW_GAP + MENU_ROW_GAP, "翻阅秘籍", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      transitionTo(this, SCENE_KEYS.scripture, { returnTo: "menu" });
    }, { fontSize: 28 });

    const settingsRow = addMinimalMenuRow(this, centerX, MENU_FIRST_ROW_Y + MAP_ROW_GAP + MENU_ROW_GAP * 2, "设置", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      transitionTo(this, SCENE_KEYS.settings, { returnTo: "menu" });
    }, { fontSize: 28 });

    // 行入场 stagger：alpha 0→1、y+10→0、delay index*90
    [startRow, mapRow, scriptureRow, settingsRow].forEach((row, index) => {
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

    // 首次可信手势统一创建/恢复 AudioContext（QA-010，消除 autoplay 警告），随后再开播菜单 BGM
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      getAudioSystem(this).unlockFromGesture();
      getAudioSystem(this).playMusic("music_menu");
    });

    // QA-004：初始化页码 / 标题下"当前关卡 · X" / document.title / 画布 aria-label
    this.syncSelectedMapChrome();

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

  /** 读存档中的选关地图 id；缺失/非法时回默认（青石山道）。 */
  private readSelectedMapId(saveData: SaveData): StageMapId {
    const found = stageMapConfig.maps.find((entry) => entry.id === saveData.lastMapId);
    return found ? found.id : stageMapConfig.defaultMapId;
  }

  /** 选关行/◀ ▶ 箭头点击：按 maps 数组顺序循环切换（direction ±1） → 写存档 → 联动 UI 同步 → 金色微闪。 */
  private cycleMapSelection(direction = 1): void {
    const saveData = getSaveData(this);
    const maps = stageMapConfig.maps;
    if (maps.length < 2 || !this.mapRowText) {
      return;
    }
    const currentId = this.readSelectedMapId(saveData);
    const currentIndex = Math.max(0, maps.findIndex((entry) => entry.id === currentId));
    const next = maps[(currentIndex + direction + maps.length) % maps.length];

    saveData.lastMapId = next.id;
    saveSystem.write(saveData);
    setSaveData(this, saveData);

    getAudioSystem(this).playPlaceholder("ui_click");

    // QA-004：行内文字 + 行尾页码 + 标题下联动行 + document.title / aria-label 一次性同步
    this.syncSelectedMapChrome();

    const text = this.mapRowText;
    // 金色微闪：染金 + 120ms 缩放脉冲；清色用 delayedCall（hover 会 killTweensOf(text)，避免金色残留）
    this.tweens.killTweensOf(text);
    text.setTint(PALETTE.accentGold);
    this.tweens.add({
      targets: text,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 120,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        text.setScale(1);
      }
    });
    this.time.delayedCall(240, () => {
      text.clearTint();
    });
  }

  /**
   * QA-004 选关可发现性：选关行两侧 ◀ ▶ 可点击箭头、行尾页码、行下"点击切换"小字。
   * 全部挂进选关行容器（局部坐标），随行的入场 stagger 一起淡入；初始位置由 layoutMapRowChrome 校正。
   */
  private addMapRowChrome(mapRow: MinimalRowHandle): void {
    this.mapArrowLeft = this.add.text(-80, 0, "◀", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_BODY,
      fontSize: "20px"
    }).setOrigin(0.5).setResolution(2).setAlpha(0.7);
    this.mapArrowRight = this.add.text(80, 0, "▶", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_BODY,
      fontSize: "20px"
    }).setOrigin(0.5).setResolution(2).setAlpha(0.7);
    this.mapPageText = this.add.text(120, 0, "", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0.5).setResolution(2).setAlpha(0.9);
    const hint = this.add.text(0, MAP_HINT_OFFSET_Y, "点击切换", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0.5).setResolution(2).setAlpha(0.75);

    this.bindMapArrow(this.mapArrowLeft, -1);
    this.bindMapArrow(this.mapArrowRight, 1);
    mapRow.container.add([this.mapArrowLeft, this.mapArrowRight, this.mapPageText, hint]);
    this.layoutMapRowChrome();
  }

  /** ◀ ▶ 箭头：加大热区 + hover 染金，点击按方向切换（阻止冒泡到选关行容器，避免一次点击连切两回）。 */
  private bindMapArrow(arrow: Phaser.GameObjects.Text, direction: number): void {
    arrow.setInteractive(
      new Phaser.Geom.Rectangle(-18, -16, arrow.width + 36, arrow.height + 32),
      Phaser.Geom.Rectangle.Contains
    );
    if (arrow.input) {
      arrow.input.cursor = "pointer";
    }
    arrow.on(Phaser.Input.Events.POINTER_OVER, () => {
      arrow.setAlpha(1).setTint(PALETTE.accentGold);
    });
    arrow.on(Phaser.Input.Events.POINTER_OUT, () => {
      arrow.setAlpha(0.7).clearTint();
    });
    arrow.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.cycleMapSelection(direction);
      }
    );
  }

  /** 选关行文字宽度变化后重排 ◀ ▶ 与页码（容器局部坐标，行文字居中于 0）。 */
  private layoutMapRowChrome(): void {
    if (!this.mapRowText || !this.mapArrowLeft || !this.mapArrowRight || !this.mapPageText) {
      return;
    }
    const halfWidth = this.mapRowText.width / 2;
    this.mapArrowLeft.setX(-(halfWidth + MAP_ARROW_GAP));
    this.mapArrowRight.setX(halfWidth + MAP_ARROW_GAP);
    this.mapPageText.setX(halfWidth + MAP_ARROW_GAP + MAP_PAGE_GAP);
  }

  /**
   * QA-004：选关状态 → 全部联动处一次性同步：
   * 行内文字、行尾页码、标题下"当前关卡 · X"、document.title、canvas / #game-root 的 aria-label。
   */
  private syncSelectedMapChrome(): void {
    const maps = stageMapConfig.maps;
    if (maps.length === 0) {
      return;
    }
    const mapId = this.readSelectedMapId(getSaveData(this));
    const index = Math.max(0, maps.findIndex((entry) => entry.id === mapId));
    const map = maps[index] ?? maps[0];

    this.mapRowText?.setText(spacedText(`关卡 · ${map.displayName}`));
    this.mapPageText?.setText(`${index + 1}/${maps.length}`);
    this.currentMapText?.setText(`当前关卡 · ${map.displayName}`);
    this.layoutMapRowChrome();

    // document.title 与画布 aria-label 随当前地图同步（标签页与屏幕阅读器可辨识当前关卡）
    try {
      document.title = map.displayName;
      const ariaLabel = `${map.displayName}游戏画布`;
      this.game.canvas?.setAttribute("aria-label", ariaLabel);
      document.getElementById("game-root")?.setAttribute("aria-label", ariaLabel);
    } catch {
      // 非浏览器环境（测试/SSR）静默跳过
    }
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
