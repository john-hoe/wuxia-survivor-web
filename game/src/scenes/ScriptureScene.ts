import Phaser from "phaser";
import type { RunSummary, SaveData } from "../types";
import { getSafePanelWidth } from "../ui/ArtPanel";
import {
  addMinimalBackdrop,
  addMinimalBackRow,
  addMinimalMenuRow,
  addMinimalTitle,
  type MinimalRowHandle
} from "../ui/minimalTheme";
import { fadeIn, FONT_BODY, FONT_MONO, FONT_TITLE, PALETTE, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getRunSummary, getSaveData, setSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { JuiceSystem } from "../systems/JuiceSystem";
import { saveSystem } from "../systems/SaveSystem";
import { SCENE_KEYS } from "./sceneKeys";

type ScriptureSceneData = {
  returnTo?: "menu" | "result";
  runSummary?: RunSummary;
  view?: ScriptureView;
};

type ScriptureView = "meta" | "scripture";
type ScriptureRarity = "common" | "rare" | "elite" | "epic";
type ScriptureRewardKind = "fragment" | "copper" | "skin" | "title";

type MetaUpgradeDefinition = {
  key: keyof SaveData["metaUpgrades"];
  title: string;
  description: string;
  effect: string;
  iconKey: string;
  costs: number[];
};

type ScriptureRewardDefinition = {
  id: string;
  rarity: ScriptureRarity;
  kind: ScriptureRewardKind;
  title: string;
  iconKey: string;
  amount: number;
  collectionKey?: string;
};

type ScriptureCompensation = {
  title: string;
  iconKey: string;
  amount: number;
  fragmentKey?: string;
  copper?: number;
};

type ScripturePullResult = {
  reward: ScriptureRewardDefinition;
  duplicate: boolean;
  pityTriggered: boolean;
  compensation?: ScriptureCompensation;
};

type TunableObject = Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;

type LayoutTunerTarget = {
  id: string;
  target: TunableObject;
  onMove?: (dx: number, dy: number) => void;
};

type LayoutTunerHandle = LayoutTunerTarget & {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const PULL_ONCE_COST = 300;
const PULL_TEN_COST = 3000;
const RARE_OR_BETTER_PITY = 20;
const TEN_RESULT_ROW_LAYOUT = { x: 17.9, y: 14.5, width: 790, height: 92 } as const;
const TEN_RESULT_SLOT_LAYOUTS = [
  { slotX: -312.1, slotY: -5.5, labelX: -312.1, labelY: 42.5 },
  { slotX: -239.1, slotY: -5.5, labelX: -240.8, labelY: 43.3 },
  { slotX: -171.2, slotY: -2.1, labelX: -170.4, labelY: 43.3 },
  { slotX: -99.9, slotY: -3, labelX: -98.2, labelY: 42.5 },
  { slotX: -32, slotY: -3.8, labelX: -35.4, labelY: 41.6 },
  { slotX: 35, slotY: -3, labelX: 35, labelY: 42.5 },
  { slotX: 104.6, slotY: -4.7, labelX: 107.1, labelY: 42.5 },
  { slotX: 175, slotY: -3, labelX: 176.7, labelY: 42.5 },
  { slotX: 243.8, slotY: -4.7, labelX: 247.2, labelY: 42.5 },
  { slotX: 308.3, slotY: -4.7, labelX: 312.5, labelY: 43.3 }
] as const;

/** 卷轴式结果演出：纸面尺寸 / 木轴参数 / 展开与合拢时长（方向D d-scripture 原型）。 */
const SCROLL_RESULT_LAYOUT = {
  /** 卷轴中心下移到 y=450：概率列表末行（绝学 y≈347）保持可见，面板占用揭示期空出的中下部 */
  y: 450,
  paperHeight: 136,
  singlePaperWidth: 560,
  tenPaperWidth: 780,
  rodWidth: 24,
  /** 轴身超出纸面上下缘的长度 */
  rodOverhang: 8,
  /** 展开到位后轴心超出纸面左右缘的距离 */
  rodBeyondEdge: 9,
  openMs: 380,
  closeMs: 260,
  /** 落墨前的全黑墨色 */
  inkTint: 0x1a1f1a
} as const;

type ScrollRig = {
  container: Phaser.GameObjects.Container;
  paper: Phaser.GameObjects.Image;
  leftRod: Phaser.GameObjects.Image;
  rightRod: Phaser.GameObjects.Image;
  width: number;
  rodOffset: number;
};

const META_UPGRADES: MetaUpgradeDefinition[] = [
  {
    key: "max_hp",
    title: "体魄训练",
    description: "最大血量",
    effect: "每级 +5%",
    iconKey: "meta_icon_body_training",
    costs: [120, 220, 360, 520, 720]
  },
  {
    key: "move_speed",
    title: "轻功步法",
    description: "移动速度",
    effect: "每级 +3%",
    iconKey: "meta_icon_lightfoot",
    costs: [120, 220, 360, 520, 720]
  },
  {
    key: "pickup_radius",
    title: "磁石锦囊",
    description: "拾取半径",
    effect: "每级 +5%",
    iconKey: "meta_icon_magnet_pouch",
    costs: [100, 200, 320, 480, 680]
  }
];

const SCRIPTURE_REWARDS: ScriptureRewardDefinition[] = [
  {
    id: "common_fragment",
    rarity: "common",
    kind: "fragment",
    title: "普通残页",
    iconKey: "ui_icon_scripture_common_fragment",
    amount: 1,
    collectionKey: "common_scripture"
  },
  {
    id: "copper_return",
    rarity: "common",
    kind: "copper",
    title: "铜钱返还",
    iconKey: "ui_icon_scripture_copper_return",
    amount: 30
  },
  {
    id: "cosmetic_hat",
    rarity: "rare",
    kind: "skin",
    title: "斗笠外观",
    iconKey: "scripture_reward_cosmetic_hat",
    amount: 1,
    collectionKey: "cosmetic_hat_bamboo"
  },
  {
    id: "sword_tassel",
    rarity: "rare",
    kind: "skin",
    title: "青纹剑穗",
    iconKey: "scripture_reward_sword_tassel",
    amount: 1,
    collectionKey: "sword_tassel_green"
  },
  {
    id: "body_fragment",
    rarity: "rare",
    kind: "fragment",
    title: "体魄碎片",
    iconKey: "ui_icon_scripture_body_fragment",
    amount: 1,
    collectionKey: "body_training"
  },
  {
    id: "lightfoot_fragment",
    rarity: "rare",
    kind: "fragment",
    title: "轻功碎片",
    iconKey: "ui_icon_scripture_lightfoot_fragment",
    amount: 1,
    collectionKey: "lightfoot"
  },
  {
    id: "elite_mind_fragment",
    rarity: "elite",
    kind: "fragment",
    title: "心法碎片",
    iconKey: "ui_icon_scripture_elite_mind_fragment",
    amount: 1,
    collectionKey: "elite_mind"
  },
  {
    id: "epic_title_scroll",
    rarity: "epic",
    kind: "title",
    title: "青石侠名",
    iconKey: "scripture_reward_epic_title_scroll",
    amount: 1,
    collectionKey: "title_qingshi_walker"
  }
];

const RARITY_LABELS: Record<ScriptureRarity, string> = {
  common: "普通",
  rare: "精良",
  elite: "上乘",
  epic: "绝学"
};

const RARITY_COLORS: Record<ScriptureRarity, string> = PALETTE.rarity as Record<ScriptureRarity, string>;

type TenRevealEntry = {
  slot: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  result: ScripturePullResult;
  revealed: boolean;
};

export class ScriptureScene extends Phaser.Scene {
  private returnTo: "menu" | "result" = "menu";
  private runSummary?: RunSummary;
  private activeView: ScriptureView = "scripture";
  private content?: Phaser.GameObjects.Container;
  private resultPanel?: Phaser.GameObjects.Container;
  private debugOverlay?: Phaser.GameObjects.Container;
  private pullButtons: MinimalRowHandle[] = [];
  private statusText?: Phaser.GameObjects.Text;
  private resultHiddenObjects: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Container> = [];
  private pendingLayoutTargets: LayoutTunerTarget[] = [];
  private layoutTunerEnabled = false;
  private layoutTunerOverlay?: Phaser.GameObjects.Container;
  private layoutTunerInfo?: Phaser.GameObjects.Text;
  private layoutTunerHandles: LayoutTunerHandle[] = [];
  private selectedLayoutHandle?: LayoutTunerHandle;
  private revealTimers: Phaser.Time.TimerEvent[] = [];
  private tenRevealEntries: TenRevealEntry[] = [];
  private scrollRig?: ScrollRig;
  private resultContent?: Phaser.GameObjects.Container;
  private resultClosing = false;

  constructor() {
    super(SCENE_KEYS.scripture);
  }

  init(data: ScriptureSceneData): void {
    this.returnTo = data.returnTo ?? "menu";
    this.runSummary = data.runSummary;
    this.activeView = data.view ?? "scripture";
  }

  create(): void {
    enterScreen(this, "scripture");
    eventBus.emit("scripture_screen_opened", {});
    // 极简碑林：氛围底与书法标题常驻场景层（视图切换/揭示重建时保持，不随 content 销毁）
    addMinimalBackdrop(this);
    addMinimalTitle(this, "翻阅秘籍", 52, 46, "秘");
    this.renderView();
    this.installDebugShowcaseKeys();
    fadeIn(this);
  }

  private renderView(): void {
    this.content?.destroy(true);
    this.resultPanel = undefined;
    this.scrollRig = undefined;
    this.resultContent = undefined;
    this.resultClosing = false;
    this.debugOverlay = undefined;
    this.pullButtons = [];
    this.statusText = undefined;
    this.resultHiddenObjects = [];
    this.pendingLayoutTargets = [];
    this.clearRevealState();
    this.destroyLayoutTunerOverlay();
    this.content = this.add.container(0, 0);

    const centerX = this.scale.width / 2;
    this.addViewTab(centerX - 90, "局外成长", "meta");
    this.addViewTab(centerX + 90, "翻阅秘籍", "scripture");
    this.addToContent(addMinimalBackRow(this, () => this.returnFromScene()).container);

    if (this.activeView === "meta") {
      this.drawMetaView();
    } else {
      this.drawScriptureView();
    }

    // 视图切换：content 容器 120ms 淡入（与设置/暂停一致）
    this.content.setAlpha(0);
    this.tweens.add({
      targets: this.content,
      alpha: 1,
      duration: 120,
      ease: Phaser.Math.Easing.Linear
    });
  }

  /** 信息行左段：铜钱小字（标签次级色 13px + 数值芥金 FONT_MONO 14px），x 为左缘。 */
  private addCopperInfo(x: number, y: number, copper: number): void {
    const label = this.add.text(0, 0, "铜钱 ", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0, 0.5).setResolution(2);
    const value = this.add.text(label.displayWidth, 0, `${copper}`, {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_MONO,
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setResolution(2);
    this.addToContent(this.add.container(x, y, [label, value]));
  }

  /** 信息行右段："距保底 N 次" 右对齐；≤3 次时数值芥金脉冲呼吸（沿用旧胶囊脉冲节奏，随销毁自动清理）。 */
  private addPityInfo(x: number, y: number, pullsUntilPity: number): void {
    const tail = this.add.text(0, 0, " 次", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0, 0.5).setResolution(2);
    const value = this.add.text(0, 0, `${pullsUntilPity}`, {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_MONO,
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setResolution(2);
    const label = this.add.text(0, 0, "距保底 ", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0, 0.5).setResolution(2);
    // 右对齐：整体末端贴 x
    tail.setX(-tail.displayWidth);
    value.setX(tail.x - value.displayWidth);
    label.setX(value.x - label.displayWidth);
    this.addToContent(this.add.container(x, y, [label, value, tail]));
    if (pullsUntilPity > 3) {
      return;
    }
    const pulse = this.tweens.add({
      targets: value,
      alpha: 0.4,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut
    });
    value.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
  }

  private drawMetaView(): void {
    const saveData = getSaveData(this);
    this.addCopperInfo(200, 170, saveData.copper);
    this.addToContent(this.add.text(760, 170, "铜钱来自战后清点 · 最高 5 级", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(1, 0.5).setResolution(2));

    // 三张去面板化成长卡，92px 等距节奏
    const cardYs = [226, 318, 410];
    META_UPGRADES.forEach((upgrade, index) => {
      this.addMetaUpgradeCard(upgrade, cardYs[index] ?? 226, saveData);
    });
    this.statusText = this.addToContent(this.add.text(this.scale.width / 2, 474, "", {
      color: PALETTE.legacyGoldCss,
      fontFamily: FONT_BODY,
      fontSize: "14px"
    }).setOrigin(0.5).setResolution(2));
  }

  private drawScriptureView(): void {
    const saveData = getSaveData(this);
    const centerX = this.scale.width / 2;
    const pullsUntilPity = Math.max(1, RARE_OR_BETTER_PITY - saveData.scriptureGacha.starter_scripture_pool.pityCounter);
    // 顶部一行小字：左"铜钱 N" / 右"距保底 N 次"（数值芥金 FONT_MONO，≤3 保底脉冲保留）
    this.addCopperInfo(200, 170, saveData.copper);
    this.addPityInfo(760, 170, pullsUntilPity);

    // 疏朗四行概率：稀有度书法 20px / 说明 13px 次级 / 居中虚线引导 / 概率 FONT_MONO 右对齐
    this.addProbabilityRows(200, 760, 218, 43);

    this.statusText = this.addToContent(this.add.text(centerX, 388, "20 次内至少 1 个精良或以上 · 重复收藏转为残页", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px"
    }).setOrigin(0.5).setResolution(2));
    this.resultHiddenObjects.push(this.statusText);

    // 极简菜单行抽卡："翻阅一次" 主 highlight；铜钱不足禁用
    const pullOnce = addMinimalMenuRow(this, centerX, 428, `翻阅一次 · ${PULL_ONCE_COST} 铜钱`, () => this.pullScripture(1), { highlight: true, fontSize: 22 });
    pullOnce.setEnabled(saveData.copper >= PULL_ONCE_COST);
    const pullTen = addMinimalMenuRow(this, centerX, 474, `翻阅十次 · ${PULL_TEN_COST} 铜钱`, () => this.pullScripture(10), { fontSize: 22 });
    pullTen.setEnabled(saveData.copper >= PULL_TEN_COST);
    this.pullButtons = [pullOnce, pullTen];
    this.pullButtons.forEach((handle) => {
      this.addToContent(handle.container);
      this.resultHiddenObjects.push(handle.container);
    });
  }

  /** 成长卡：无底色，图标 + 名称/效果/等级左排，价格与购买行右排，底部 1px 低透 hairline 分隔。 */
  private addMetaUpgradeCard(upgrade: MetaUpgradeDefinition, y: number, saveData: SaveData): void {
    const centerX = this.scale.width / 2;
    const level = saveData.metaUpgrades[upgrade.key];
    const maxLevel = upgrade.costs.length;
    const nextCost = upgrade.costs[level];
    const canBuy = nextCost !== undefined && saveData.copper >= nextCost;

    this.addIcon(upgrade.iconKey, centerX - 262, y, 40);
    this.addToContent(this.add.text(centerX - 228, y - 15, upgrade.title, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: "20px"
    }).setOrigin(0, 0.5).setResolution(2));
    this.addToContent(this.add.text(centerX - 228, y + 15, `${upgrade.description} ${upgrade.effect} · 等级 ${level}/${maxLevel}`, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0, 0.5).setResolution(2));

    const button = addMinimalMenuRow(this, centerX + 180, y, nextCost === undefined ? "已满" : `提升 · ${nextCost} 铜钱`, () => this.purchaseMetaUpgrade(upgrade), { fontSize: 18 });
    button.setEnabled(canBuy);
    this.addToContent(button.container);
    // 卡片底部 1px 低透 hairline 分隔
    this.addToContent(this.add.rectangle(centerX, y + 46, 600, 1, PALETTE.accentGold, 0.16));
  }

  /**
   * 概率列表（无面板）：稀有度名书法 20px 按 PALETTE.rarity 着色（左缘 leftX）、
   * 说明 13px 次级色、说明与概率之间居中虚线引导、概率 FONT_MONO 右对齐（右缘 rightX）。
   */
  private addProbabilityRows(leftX: number, rightX: number, startY: number, rowGap: number): void {
    const rows = [
      { rarity: "common" as ScriptureRarity, chance: "65%", label: "残页 / 铜钱返还" },
      { rarity: "rare" as ScriptureRarity, chance: "25%", label: "外观 / 成长碎片" },
      { rarity: "elite" as ScriptureRarity, chance: "9%", label: "稀有心法碎片" },
      { rarity: "epic" as ScriptureRarity, chance: "1%", label: "称号卷轴" }
    ];

    rows.forEach((row, index) => {
      const y = startY + index * rowGap;
      this.addToContent(this.add.text(leftX, y, RARITY_LABELS[row.rarity], {
        color: RARITY_COLORS[row.rarity],
        fontFamily: FONT_TITLE,
        fontSize: "20px"
      }).setOrigin(0, 0.5).setResolution(2));
      const desc = this.addToContent(this.add.text(leftX + 92, y, row.label, {
        color: PALETTE.textSecondary,
        fontFamily: FONT_BODY,
        fontSize: "13px"
      }).setOrigin(0, 0.5).setResolution(2));
      const pct = this.addToContent(this.add.text(rightX, y, row.chance, {
        color: PALETTE.textPrimary,
        fontFamily: FONT_MONO,
        fontSize: "15px",
        fontStyle: "bold"
      }).setOrigin(1, 0.5).setResolution(2));
      const dotsFrom = leftX + 92 + desc.displayWidth + 16;
      const dotsTo = rightX - pct.displayWidth - 16;
      if (dotsTo > dotsFrom) {
        this.addToContent(this.createDottedLeader(dotsFrom, dotsTo, y));
      }
    });
  }

  /** 虚线引导：1px 圆点、6px 间隔、低透白（对应原型 border-bottom dotted）。 */
  private createDottedLeader(fromX: number, toX: number, y: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 0.26);
    for (let x = fromX; x <= toX; x += 6) {
      graphics.fillCircle(x, y, 1);
    }
    return graphics;
  }

  private installDebugShowcaseKeys(): void {
    if (!import.meta.env.DEV || !this.input.keyboard) {
      return;
    }
    const rewardKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F6);
    const singleResultKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F7);
    const tenResultKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F8);
    const handler = (): void => this.showSwArt016RewardShowcase();
    const singleHandler = (): void => this.showSwArt017SingleResultShowcase();
    const tenHandler = (): void => this.showSwArt017TenResultShowcase();
    const tunerKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    const copyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const tunerHandler = (): void => this.toggleLayoutTuner();
    const copyHandler = (): void => this.copyLayoutTunerSnapshot();
    const upHandler = (keyOrEvent?: unknown, event?: KeyboardEvent): void => {
      preventKeyboardDefault(keyOrEvent, event);
      this.nudgeSelectedLayoutTarget(0, isShiftKeyDown(keyOrEvent, event) ? -10 : -1);
    };
    const downHandler = (keyOrEvent?: unknown, event?: KeyboardEvent): void => {
      preventKeyboardDefault(keyOrEvent, event);
      this.nudgeSelectedLayoutTarget(0, isShiftKeyDown(keyOrEvent, event) ? 10 : 1);
    };
    const leftHandler = (keyOrEvent?: unknown, event?: KeyboardEvent): void => {
      preventKeyboardDefault(keyOrEvent, event);
      this.nudgeSelectedLayoutTarget(isShiftKeyDown(keyOrEvent, event) ? -10 : -1, 0);
    };
    const rightHandler = (keyOrEvent?: unknown, event?: KeyboardEvent): void => {
      preventKeyboardDefault(keyOrEvent, event);
      this.nudgeSelectedLayoutTarget(isShiftKeyDown(keyOrEvent, event) ? 10 : 1, 0);
    };
    rewardKey.on("down", handler);
    singleResultKey.on("down", singleHandler);
    tenResultKey.on("down", tenHandler);
    tunerKey.on("down", tunerHandler);
    copyKey.on("down", copyHandler);
    upKey.on("down", upHandler);
    downKey.on("down", downHandler);
    leftKey.on("down", leftHandler);
    rightKey.on("down", rightHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      rewardKey.off("down", handler);
      singleResultKey.off("down", singleHandler);
      tenResultKey.off("down", tenHandler);
      tunerKey.off("down", tunerHandler);
      copyKey.off("down", copyHandler);
      upKey.off("down", upHandler);
      downKey.off("down", downHandler);
      leftKey.off("down", leftHandler);
      rightKey.off("down", rightHandler);
    });
  }

  private purchaseMetaUpgrade(upgrade: MetaUpgradeDefinition): void {
    const saveData = cloneSaveData(getSaveData(this));
    const level = saveData.metaUpgrades[upgrade.key];
    const cost = upgrade.costs[level];
    if (cost === undefined || saveData.copper < cost) {
      this.setStatus("铜钱不足");
      return;
    }

    saveData.copper -= cost;
    saveData.metaUpgrades[upgrade.key] = Math.min(upgrade.costs.length, level + 1);
    if (!saveSystem.write(saveData)) {
      this.setStatus("本地存档失败，请稍后再试");
      return;
    }

    setSaveData(this, saveData);
    getAudioSystem(this).playPlaceholder("ui_click");
    eventBus.emit("meta_upgrade_purchased", {
      key: upgrade.key,
      level: saveData.metaUpgrades[upgrade.key],
      cost,
      remainingCopper: saveData.copper
    });
    this.renderView();
    this.setStatus(`${upgrade.title} 已提升到 ${saveData.metaUpgrades[upgrade.key]} 级`);
  }

  private pullScripture(count: 1 | 10): void {
    const saveData = cloneSaveData(getSaveData(this));
    const cost = count === 1 ? PULL_ONCE_COST : PULL_TEN_COST;
    if (saveData.copper < cost) {
      this.setStatus("铜钱不足");
      return;
    }

    eventBus.emit("scripture_pull_started", {
      count,
      cost,
      copperBefore: saveData.copper
    });
    saveData.copper -= cost;
    const results = Array.from({ length: count }, () => this.generateScriptureResult(saveData));

    if (!saveSystem.write(saveData)) {
      this.setStatus("本地存档失败，请稍后再试");
      return;
    }

    setSaveData(this, saveData);
    getAudioSystem(this).playPlaceholder(getRevealAudioEvent(results));
    this.playRevealPrelude(results);
  }

  /** 揭示前奏：淡出 → 重建视图 + 全屏 ADD 光图脉冲 → 淡入进入揭示。 */
  private playRevealPrelude(results: ScripturePullResult[]): void {
    const camera = this.cameras.main;
    camera.fadeOut(150, 10, 10, 10);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.renderView();
      this.showResultPanel(results);
      camera.fadeIn(220, 10, 10, 10);
      if (this.textures.exists("vfx_scripture_reveal")) {
        const overlay = this.add.image(this.scale.width / 2, this.scale.height / 2, "vfx_scripture_reveal")
          .setDisplaySize(this.scale.width, this.scale.height)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0)
          .setDepth(90);
        this.tweens.add({
          targets: overlay,
          alpha: 0.8,
          duration: 420,
          yoyo: true,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => overlay.destroy()
        });
      }
      if (getHighestRarity(results) !== "common") {
        camera.shake(80, 0.004);
      }
    });
  }

  private generateScriptureResult(saveData: SaveData): ScripturePullResult {
    const pool = saveData.scriptureGacha.starter_scripture_pool;
    const pityTriggered = pool.pityCounter >= RARE_OR_BETTER_PITY - 1;
    const rarity = pityTriggered ? "rare" : rollRarity();
    const reward = pickRewardByRarity(rarity);

    pool.pulls += 1;
    pool.pityCounter = rarity === "common" ? pool.pityCounter + 1 : 0;
    if (pityTriggered) {
      eventBus.emit("scripture_pity_triggered", {
        pulls: pool.pulls,
        pityCounterBefore: RARE_OR_BETTER_PITY - 1
      });
    }

    const duplicate = isDuplicateReward(saveData, reward);
    const compensation = duplicate ? createCompensation(reward.rarity) : undefined;
    if (duplicate && compensation) {
      applyCompensation(saveData, compensation);
    } else {
      applyReward(saveData, reward);
    }

    const result: ScripturePullResult = {
      reward,
      duplicate,
      pityTriggered,
      compensation
    };
    eventBus.emit("scripture_pull_result", {
      rewardId: reward.id,
      rarity: reward.rarity,
      duplicate,
      compensation: compensation?.title,
      pityTriggered
    });
    return result;
  }

  private showResultPanel(results: ScripturePullResult[]): void {
    eventBus.emit("scripture_result_confirmed", {
      count: results.length,
      rewardIds: results.map((result) => result.reward.id)
    });
    this.destroyLayoutTunerOverlay();
    this.resultPanel?.destroy(true);
    this.resultClosing = false;
    this.scrollRig = undefined;
    this.resultContent = undefined;
    this.pendingLayoutTargets = [];
    this.resultHiddenObjects.forEach((gameObject) => gameObject.setVisible(false));
    this.clearRevealState();
    const isTen = results.length > 1;
    const paperWidth = isTen
      ? getSafePanelWidth(this, SCROLL_RESULT_LAYOUT.tenPaperWidth)
      : getSafePanelWidth(this, SCROLL_RESULT_LAYOUT.singlePaperWidth, 80);
    const paperHeight = SCROLL_RESULT_LAYOUT.paperHeight;
    const headerY = -(paperHeight / 2 + 16);

    // 卷轴演出骨架：纸面（贴图或程序化兜底）+ 左右木轴 + 全卷点击收回热区
    const rig = this.createScrollRig(paperWidth, paperHeight);
    this.scrollRig = rig;

    // "所得"小标题：卷面上方小字（不再压面板顶边），FONT_TITLE 芥金
    const header = this.add.text(0, headerY, "所得", {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_TITLE,
      fontSize: "15px",
      letterSpacing: 8
    }).setOrigin(0.5).setResolution(2);

    const contentChildren: Phaser.GameObjects.GameObject[] = [header];
    if (isTen) {
      contentChildren.push(...this.createTenResultCards(results));
      contentChildren.push(this.createSkipRevealText(paperWidth));
    } else {
      contentChildren.push(...this.createSingleResultCard(results[0]));
    }
    contentChildren.push(this.createResultContinueText(paperWidth));
    this.resultContent = this.add.container(0, 0, contentChildren);

    this.resultPanel = this.add.container(this.scale.width / 2, SCROLL_RESULT_LAYOUT.y, [rig.container, this.resultContent]);
    this.content?.add(this.resultPanel);
    this.refreshLayoutTunerOverlay();

    // 展开：纸面自中央向左右拉开，两轴同步外滚（380ms Cubic.out）
    const state = { t: 0 };
    const openTween = this.tweens.add({
      targets: state,
      t: 1,
      duration: SCROLL_RESULT_LAYOUT.openMs,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => this.applyScrollOpen(rig, state.t),
      onComplete: () => this.applyScrollOpen(rig, 1)
    });
    rig.container.once(Phaser.GameObjects.Events.DESTROY, () => openTween.remove());
    if (isTen) {
      // 展开到位后按既有错峰节奏逐槽翻面（跳过逻辑不变）
      this.revealTimers.push(this.time.delayedCall(SCROLL_RESULT_LAYOUT.openMs, () => this.startTenReveal(results)));
    }
  }

  /** 结果关闭：内容淡出，卷轴向中合拢收回（260ms）后再销毁面板。 */
  private dismissResultPanel(): void {
    if (!this.resultPanel || this.resultClosing) {
      return;
    }
    this.destroyLayoutTunerOverlay();
    this.clearRevealState();
    const rig = this.scrollRig;
    if (!rig) {
      this.teardownResultPanel();
      return;
    }
    this.resultClosing = true;
    if (this.resultContent) {
      this.tweens.add({
        targets: this.resultContent,
        alpha: 0,
        duration: 180,
        ease: Phaser.Math.Easing.Linear
      });
    }
    const state = { t: 1 };
    const closeTween = this.tweens.add({
      targets: state,
      t: 0,
      duration: SCROLL_RESULT_LAYOUT.closeMs,
      ease: Phaser.Math.Easing.Cubic.In,
      onUpdate: () => this.applyScrollOpen(rig, Math.max(state.t, 0.004)),
      onComplete: () => this.teardownResultPanel()
    });
    rig.container.once(Phaser.GameObjects.Events.DESTROY, () => closeTween.remove());
  }

  private teardownResultPanel(): void {
    this.resultClosing = false;
    this.scrollRig = undefined;
    this.resultContent = undefined;
    this.resultPanel?.destroy(true);
    this.resultPanel = undefined;
    this.pendingLayoutTargets = [];
    this.resultHiddenObjects.forEach((gameObject) => gameObject.setVisible(true));
  }

  /** 组装卷轴：纸面 Image（可裁宽）+ 左右木轴 + 点击收回热区，初始为合拢态。 */
  private createScrollRig(paperWidth: number, paperHeight: number): ScrollRig {
    const paperKey = this.ensureScrollPaperTexture(Math.round(paperWidth), paperHeight);
    const rodKey = this.ensureScrollRodTexture(paperHeight);
    const rodHeight = paperHeight + SCROLL_RESULT_LAYOUT.rodOverhang * 2 + 14;
    const paper = this.add.image(0, 0, paperKey).setDisplaySize(paperWidth, paperHeight);
    const leftRod = this.add.image(0, 0, rodKey).setDisplaySize(SCROLL_RESULT_LAYOUT.rodWidth, rodHeight);
    const rightRod = this.add.image(0, 0, rodKey).setDisplaySize(SCROLL_RESULT_LAYOUT.rodWidth, rodHeight);
    const hit = this.add.rectangle(0, 0, paperWidth + 72, rodHeight + 24, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.dismissResultPanel());
    const container = this.add.container(0, 0, [paper, leftRod, rightRod, hit]);
    const rig: ScrollRig = {
      container,
      paper,
      leftRod,
      rightRod,
      width: paperWidth,
      rodOffset: SCROLL_RESULT_LAYOUT.rodBeyondEdge
    };
    this.applyScrollOpen(rig, 0.004);
    return rig;
  }

  /** 展开进度 t（0→1）：纸面以中心裁宽实现"展开"感，两轴从中心叠合随 t 外滚分离。 */
  private applyScrollOpen(rig: ScrollRig, t: number): void {
    const ratio = Phaser.Math.Clamp(t, 0.004, 1);
    const frame = rig.paper.frame;
    const cropWidth = Math.max(1, frame.width * ratio);
    rig.paper.setCrop((frame.width - cropWidth) / 2, 0, cropWidth, frame.height);
    const rodX = (rig.width * ratio) / 2 + rig.rodOffset * ratio;
    rig.leftRod.setX(-rodX);
    rig.rightRod.setX(rodX);
  }

  /** 纸面贴图：优先并行代理注册的 ui_scroll_paper；缺失时程序化生成圆角纸色兜底。 */
  private ensureScrollPaperTexture(width: number, height: number): string {
    if (this.textures.exists("ui_scroll_paper")) {
      return "ui_scroll_paper";
    }
    const key = `gen_scroll_paper_${width}x${height}`;
    if (!this.textures.exists(key)) {
      this.createFallbackPaperTexture(key, width, height);
    }
    return key;
  }

  /** 木轴贴图：优先 ui_scroll_rod；缺失时程序化生成棕色圆柱 + 芥金轴头兜底。 */
  private ensureScrollRodTexture(paperHeight: number): string {
    if (this.textures.exists("ui_scroll_rod")) {
      return "ui_scroll_rod";
    }
    const rodHeight = paperHeight + SCROLL_RESULT_LAYOUT.rodOverhang * 2 + 14;
    const key = `gen_scroll_rod_${SCROLL_RESULT_LAYOUT.rodWidth}x${rodHeight}`;
    if (!this.textures.exists(key)) {
      this.createFallbackRodTexture(key, SCROLL_RESULT_LAYOUT.rodWidth, rodHeight);
    }
    return key;
  }

  /** 兜底纸面：#f2ecdc 圆角微渐变 + 两端轴影 + 纸丝横纹 + 芥金细描边。 */
  private createFallbackPaperTexture(key: string, width: number, height: number): void {
    const g = this.add.graphics();
    // 纵向微渐变（上略亮、下略沉）
    g.fillGradientStyle(0xf6f0e0, 0xf6f0e0, 0xe9ddba, 0xe9ddba, 1);
    g.fillRoundedRect(0, 0, width, height, 4);
    // 左右两端轴卷压影
    const shade = Math.min(56, Math.floor(width * 0.1));
    g.fillGradientStyle(0x5a4018, 0x5a4018, 0x5a4018, 0x5a4018, 0.16, 0, 0.16, 0);
    g.fillRect(0, 0, shade, height);
    g.fillGradientStyle(0x5a4018, 0x5a4018, 0x5a4018, 0x5a4018, 0, 0.16, 0, 0.16);
    g.fillRect(width - shade, 0, shade, height);
    // 宣纸细丝
    g.lineStyle(1, 0x8a6f3c, 0.05);
    for (let y = 5; y < height - 3; y += 5) {
      g.lineBetween(6, y, width - 6, y);
    }
    // 上高光 / 下暗影
    g.fillStyle(0xfffdf2, 0.55);
    g.fillRect(3, 1, width - 6, 1);
    g.fillStyle(0x8a6f3c, 0.22);
    g.fillRect(3, height - 2, width - 6, 1);
    // 芥金细描边
    g.lineStyle(1, 0xa99a20, 0.3);
    g.strokeRoundedRect(0.5, 0.5, width - 1, height - 1, 4);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  /** 兜底木轴：深棕圆柱（左暗→中亮→右暗）+ 上下芥金轴头圆珠。 */
  private createFallbackRodTexture(key: string, width: number, height: number): void {
    const g = this.add.graphics();
    const bodyInset = 3;
    const bodyW = width - bodyInset * 2;
    // 轴身底色 + 水平圆柱光泽
    g.fillStyle(0x4a3423, 1);
    g.fillRoundedRect(bodyInset, 9, bodyW, height - 18, bodyW / 2);
    g.fillGradientStyle(0x160f09, 0x6a4c32, 0x160f09, 0x6a4c32, 1);
    g.fillRect(bodyInset + 1, 10, bodyW / 2 - 1, height - 20);
    g.fillGradientStyle(0x6a4c32, 0x241a10, 0x6a4c32, 0x241a10, 1);
    g.fillRect(bodyInset + bodyW / 2, 10, bodyW / 2 - 1, height - 20);
    // 轴身中线高光
    g.fillStyle(0x8a6844, 0.5);
    g.fillRect(width / 2 - 2, 12, 2, height - 24);
    // 芥金轴头（上 / 下圆珠 + 高光点）
    [7, height - 7].forEach((cy) => {
      g.fillStyle(0x8a7018, 1);
      g.fillCircle(width / 2, cy, 6);
      g.fillStyle(0xd8bd55, 1);
      g.fillCircle(width / 2, cy, 4.6);
      g.fillStyle(0xf0d98a, 1);
      g.fillCircle(width / 2 - 1.4, cy - 1.6, 1.7);
    });
    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 单抽落墨：图标先全黑（墨色）→ alpha 0→1 + 微缩放 Back.easeOut，墨色 200ms 内褪为显色；
   * 名称/明细错峰落墨；稀有度闪光、elite/epic goldBurst、保底粒子沿用原反馈链。
   */
  private revealSingleResultInk(
    result: ScripturePullResult,
    slot: Phaser.GameObjects.Container,
    title: Phaser.GameObjects.Text,
    postRevealObjects: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>
  ): void {
    slot.setAlpha(1);
    const icon = slot.getData("icon") as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined;
    if (icon) {
      const baseScaleX = icon.scaleX;
      const baseScaleY = icon.scaleY;
      icon.setVisible(true);
      icon.setAlpha(0).setScale(baseScaleX * 0.82, baseScaleY * 0.82);
      this.tweens.add({
        targets: icon,
        alpha: 1,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        duration: 340,
        ease: Phaser.Math.Easing.Back.Out
      });
      if (icon instanceof Phaser.GameObjects.Image) {
        icon.setTint(SCROLL_RESULT_LAYOUT.inkTint);
        const inkFrom = Phaser.Display.Color.IntegerToColor(SCROLL_RESULT_LAYOUT.inkTint);
        const inkTo = Phaser.Display.Color.IntegerToColor(0xffffff);
        const mix = { t: 0 };
        this.tweens.add({
          targets: mix,
          t: 1,
          duration: 200,
          delay: 90,
          ease: Phaser.Math.Easing.Linear,
          onUpdate: () => {
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(inkFrom, inkTo, 100, Math.floor(mix.t * 100));
            icon.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
          },
          onComplete: () => (icon as Phaser.GameObjects.Image).clearTint()
        });
      }
    }
    [title, ...postRevealObjects].forEach((gameObject, index) => {
      gameObject.setVisible(true);
      gameObject.setAlpha(0).setScale(0.94);
      this.tweens.add({
        targets: gameObject,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        delay: 60 + index * 60,
        ease: Phaser.Math.Easing.Back.Out
      });
    });
    const juice = JuiceSystem.get(this);
    juice.rarityFlash(result.reward.rarity);
    if (result.reward.rarity === "elite" || result.reward.rarity === "epic") {
      const world = this.getSlotWorldPosition(slot);
      juice.goldBurst(world.x, world.y, 42);
    }
    if (result.pityTriggered) {
      this.revealTimers.push(this.time.delayedCall(420, () => this.addPityFx(slot, title)));
    }
  }

  /** 清理进行中的揭示动画状态（定时器/十连条目/翻面 Tween）。 */
  private clearRevealState(): void {
    this.revealTimers.forEach((timer) => timer.remove(false));
    this.revealTimers = [];
    this.tenRevealEntries.forEach((entry) => this.tweens.killTweensOf(entry.slot));
    this.tenRevealEntries = [];
  }

  private showSwArt017SingleResultShowcase(): void {
    this.showResultPanel([
      this.createShowcaseResult("elite_mind_fragment", true, true)
    ]);
  }

  private showSwArt017TenResultShowcase(): void {
    this.showResultPanel([
      this.createShowcaseResult("common_fragment", false, false),
      this.createShowcaseResult("copper_return", false, false),
      this.createShowcaseResult("body_fragment", false, false),
      this.createShowcaseResult("lightfoot_fragment", false, false),
      this.createShowcaseResult("cosmetic_hat", false, false),
      this.createShowcaseResult("sword_tassel", true, false),
      this.createShowcaseResult("elite_mind_fragment", false, true),
      this.createShowcaseResult("epic_title_scroll", false, false),
      this.createShowcaseResult("common_fragment", true, false),
      this.createShowcaseResult("copper_return", false, false)
    ]);
  }

  private createShowcaseResult(rewardId: string, duplicate: boolean, pityTriggered: boolean): ScripturePullResult {
    const reward = SCRIPTURE_REWARDS.find((item) => item.id === rewardId) ?? SCRIPTURE_REWARDS[0];
    return {
      reward,
      duplicate,
      pityTriggered,
      compensation: duplicate ? createCompensation(reward.rarity) : undefined
    };
  }

  private showSwArt016RewardShowcase(): void {
    this.debugOverlay?.destroy(true);
    const items = [
      { key: "ui_icon_scripture_common_fragment", label: "普通残页" },
      { key: "ui_icon_scripture_body_fragment", label: "体魄碎片" },
      { key: "ui_icon_scripture_lightfoot_fragment", label: "轻功碎片" },
      { key: "ui_icon_scripture_elite_mind_fragment", label: "心法碎片" },
      { key: "ui_icon_scripture_copper_return", label: "铜钱返还" },
      { key: "ui_icon_scripture_compensation_fragment", label: "补偿残页" },
      { key: "ui_icon_scripture_compensation_copper", label: "补偿铜钱" },
      { key: "ui_badge_pity", label: "保底" },
      { key: "ui_badge_duplicate", label: "重复" }
    ];
    const children: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, 780, 148, 0x101914, 0.96).setStrokeStyle(2, 0xd6c28d, 0.72),
      this.add.text(0, -56, "奖励 / 补偿 / 角标", {
        color: "#f7f0d0",
        fontFamily: FONT_BODY,
        fontSize: "18px",
        fontStyle: "bold"
      }).setOrigin(0.5).setResolution(2)
    ];

    items.forEach((item, index) => {
      const x = -320 + index * 80;
      children.push(this.createIconObject(item.key, x, -14, 46));
      children.push(this.add.text(x, 38, item.label, {
        color: "#d8ead9",
        fontFamily: FONT_BODY,
        fontSize: "12px",
        align: "center"
      }).setOrigin(0.5).setResolution(2));
    });

    this.debugOverlay = this.add.container(this.scale.width / 2, 454, children).setDepth(30);
    this.content?.add(this.debugOverlay);
  }

  /**
   * 单抽结果：匀称竖排 —— 图标居中偏上（无稀有度边框，稀有度以奖励名文字色表达）、
   * 奖励名 FONT_TITLE 稀有度色居中、说明 FONT_BODY 居中；重复时转化补偿一行整体居中。
   */
  private createSingleResultCard(result: ScripturePullResult): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const slot = this.createTunableRewardSlot("single.rewardSlot", result.reward.iconKey, 0, -26, 52, 56);
    objects.push(slot);
    this.setSlotIconVisible(slot, false);
    // 卷轴展开期间整槽隐藏，展开到位后落墨显现
    slot.setAlpha(0);

    const rarityText = `${RARITY_LABELS[result.reward.rarity]}  ${result.reward.title} x${result.reward.amount}`;
    const title = this.registerLayoutTunerTarget("single.title", this.add.text(0, 18, rarityText, {
      color: RARITY_COLORS[result.reward.rarity],
      fontFamily: FONT_TITLE,
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2));
    objects.push(title);
    title.setVisible(false);

    const postRevealObjects: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
    const detail = result.pityTriggered ? "保底触发" : result.duplicate ? "重复奖励" : "已收入收藏";
    const detailText = this.registerLayoutTunerTarget("single.detail", this.add.text(0, 41, detail, {
      color: PALETTE.legacyGoldCss,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0.5).setResolution(2));
    objects.push(detailText);
    postRevealObjects.push(detailText);

    if (result.duplicate && result.compensation) {
      // 补偿行：标签 + 小图标 + 明细作为一个整体水平居中于卷面
      const compY = 58;
      const compIconSize = 18;
      const compGap = 6;
      const compLabel = this.add.text(0, 0, "转化补偿", {
        color: "#d8ead9",
        fontFamily: FONT_BODY,
        fontSize: "12px",
        fontStyle: "bold"
      }).setOrigin(0, 0.5).setResolution(2);
      const compText = this.add.text(0, 0, `${result.compensation.title} x${result.compensation.amount}`, {
        color: "#f7f0d0",
        fontFamily: FONT_BODY,
        fontSize: "12px"
      }).setOrigin(0, 0.5).setResolution(2);
      const groupLeft = -(compLabel.displayWidth + compGap + compIconSize + compGap + compText.displayWidth) / 2;
      compLabel.setPosition(groupLeft, compY);
      const compIconX = groupLeft + compLabel.displayWidth + compGap + compIconSize / 2;
      const compIcon = this.createIconObject(result.compensation.iconKey, compIconX, compY, compIconSize);
      compText.setPosition(compIconX + compIconSize / 2 + compGap, compY);
      objects.push(
        this.registerLayoutTunerTarget("single.compLabel", compLabel),
        this.registerLayoutTunerTarget("single.compIcon", compIcon),
        this.registerLayoutTunerTarget("single.compText", compText)
      );
      postRevealObjects.push(compLabel, compIcon, compText);
    }

    postRevealObjects.forEach((gameObject) => gameObject.setVisible(false));
    // 卷轴展开到位后落墨显现（保底粒子/稀有度反馈在 revealSingleResultInk 内承接）
    this.revealTimers.push(this.time.delayedCall(SCROLL_RESULT_LAYOUT.openMs + 90, () => {
      this.revealSingleResultInk(result, slot, title, postRevealObjects);
    }));

    return objects;
  }

  private createTenResultCards(results: ScripturePullResult[]): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const rowGuide = this.add.rectangle(
      TEN_RESULT_ROW_LAYOUT.x,
      TEN_RESULT_ROW_LAYOUT.y,
      TEN_RESULT_ROW_LAYOUT.width,
      TEN_RESULT_ROW_LAYOUT.height,
      0x000000,
      0
    );
    objects.push(this.registerLayoutTunerTarget("ten.row", rowGuide, (dx, dy) => {
      this.pendingLayoutTargets.forEach((entry) => {
        if (/^ten\.\d+\./.test(entry.id)) {
          entry.target.setPosition(entry.target.x + dx, entry.target.y + dy);
        }
      });
    }));

    results.forEach((result, index) => {
      const layout = TEN_RESULT_SLOT_LAYOUTS[index] ?? TEN_RESULT_SLOT_LAYOUTS[TEN_RESULT_SLOT_LAYOUTS.length - 1];
      objects.push(...this.createSmallResultCard(layout.slotX, layout.slotY, layout.labelX, layout.labelY, result));
    });
    return objects;
  }

  private createSmallResultCard(slotX: number, slotY: number, labelX: number, labelY: number, result: ScripturePullResult): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const prefix = `ten.${this.pendingLayoutTargets.filter((entry) => entry.id.startsWith("ten.") && entry.id.endsWith(".slot")).length + 1}`;
    const slot = this.createTunableRewardSlot(`${prefix}.slot`, result.reward.iconKey, slotX, slotY, 40, 44);
    objects.push(slot);
    this.setSlotIconVisible(slot, false);
    // 卷轴展开期间整槽隐藏，翻面揭示时再亮起
    slot.setAlpha(0);
    const label = result.duplicate ? "补偿" : result.pityTriggered ? "保底" : RARITY_LABELS[result.reward.rarity];
    const labelText = this.registerLayoutTunerTarget(`${prefix}.label`, this.add.text(labelX, labelY, label, {
      color: result.duplicate || result.pityTriggered ? "#f6d472" : RARITY_COLORS[result.reward.rarity],
      fontFamily: FONT_BODY,
      fontSize: "12px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2));
    objects.push(labelText);
    labelText.setVisible(false);
    this.tenRevealEntries.push({ slot, label: labelText, result, revealed: false });
    return objects;
  }

  /** 文字页签：选中 FONT_TITLE 20px 芥金 + 笔触下划线；未选中 16px 次级色；hover 变金。 */
  private addViewTab(x: number, label: string, view: ScriptureView): void {
    const selected = this.activeView === view;
    const text = this.addToContent(this.add.text(x, 126, label, {
      color: selected ? PALETTE.accentGoldCss : PALETTE.textSecondary,
      fontFamily: FONT_TITLE,
      fontSize: selected ? "20px" : "16px"
    }).setOrigin(0.5).setResolution(2));
    if (selected) {
      // minimalTheme 未公开导出笔触纹理，按规格回退为 2px 芥金短线（随文本宽度）
      this.addToContent(this.add.rectangle(x, 148, Math.max(48, text.displayWidth * 0.92), 2, PALETTE.accentGold, 0.9));
      return;
    }
    text.setInteractive({ useHandCursor: true });
    text.on(Phaser.Input.Events.POINTER_OVER, () => text.setColor(PALETTE.accentGoldCss));
    text.on(Phaser.Input.Events.POINTER_OUT, () => text.setColor(PALETTE.textSecondary));
    text.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.activeView === view) {
        return;
      }
      getAudioSystem(this).playPlaceholder("ui_click");
      // 「局外成长」路由到经脉图场景（墨晕 B 转场）；本页保留翻阅秘籍视图
      if (view === "meta") {
        transitionTo(this, SCENE_KEYS.meridian, { returnTo: "scripture" });
        return;
      }
      this.activeView = view;
      this.renderView();
    });
  }

  private addIcon(textureKey: string, x: number, y: number, size: number): void {
    this.addToContent(this.createIconObject(textureKey, x, y, size));
  }

  private createIconObject(textureKey: string, x: number, y: number, size: number): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    if (this.textures.exists(textureKey)) {
      return this.add.image(x, y, textureKey).setDisplaySize(size, size);
    }
    return this.add.rectangle(x, y, size, size, 0x2f5b4f, 1).setStrokeStyle(2, 0xd6c28d, 0.86);
  }

  /**
   * 奖励槽：仅图标本体（稀有度改由奖励名/槽位标签文字色表达，不再叠加稀有度方框）；
   * slotSize 仅用于翻面基准与 F9 布局调试框。
   */
  private createTunableRewardSlot(
    id: string,
    iconKey: string,
    x: number,
    y: number,
    iconSize: number,
    slotSize: number
  ): Phaser.GameObjects.Container {
    const icon = this.createIconObject(iconKey, 0, 0, iconSize);
    const slot = this.add.container(x, y, [icon]);
    slot.setSize(slotSize, slotSize);
    slot.setData("icon", icon);
    return this.registerLayoutTunerTarget(id, slot);
  }

  private setSlotIconVisible(slot: Phaser.GameObjects.Container, visible: boolean): void {
    const icon = slot.getData("icon") as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined;
    icon?.setVisible(visible);
  }

  private getSlotWorldPosition(slot: Phaser.GameObjects.Container): { x: number; y: number } {
    return {
      x: (this.resultPanel?.x ?? 0) + slot.x,
      y: (this.resultPanel?.y ?? 0) + slot.y
    };
  }

  /** 卡槽翻面：scaleY→0（120ms）→ 亮出图标 + 稀有度反馈 → scaleY→1（Back.easeOut）。 */
  private flipSlot(slot: Phaser.GameObjects.Container, rarity: ScriptureRarity, flash: boolean, onRevealed?: () => void): void {
    this.tweens.killTweensOf(slot);
    const flipDown = this.tweens.add({
      targets: slot,
      scaleY: 0,
      duration: 120,
      ease: Phaser.Math.Easing.Quadratic.In,
      onComplete: () => {
        this.setSlotIconVisible(slot, true);
        const juice = JuiceSystem.get(this);
        if (flash) {
          juice.rarityFlash(rarity);
        }
        if (rarity === "elite" || rarity === "epic") {
          const world = this.getSlotWorldPosition(slot);
          juice.goldBurst(world.x, world.y, 42);
        }
        onRevealed?.();
        const flipUp = this.tweens.add({
          targets: slot,
          scaleY: 1,
          duration: 240,
          ease: Phaser.Math.Easing.Back.Out
        });
        slot.once(Phaser.GameObjects.Events.DESTROY, () => flipUp.remove());
      }
    });
    slot.once(Phaser.GameObjects.Events.DESTROY, () => flipDown.remove());
  }

  /** 十连错峰揭示：普通在前，精良及以上排到后半段拉期待。 */
  private startTenReveal(results: ScripturePullResult[]): void {
    const order = results
      .map((_, index) => index)
      .sort((a, b) => getRarityRank(results[a].reward.rarity) - getRarityRank(results[b].reward.rarity));
    order.forEach((slotIndex, orderPosition) => {
      this.revealTimers.push(this.time.delayedCall(240 + orderPosition * 120, () => {
        this.revealTenEntry(slotIndex, false);
      }));
    });
  }

  private revealTenEntry(slotIndex: number, instant: boolean): void {
    const entry = this.tenRevealEntries[slotIndex];
    if (!entry || entry.revealed) {
      return;
    }
    entry.revealed = true;
    entry.slot.setAlpha(1);
    if (instant) {
      this.tweens.killTweensOf(entry.slot);
      entry.slot.setScale(1, 1);
      this.setSlotIconVisible(entry.slot, true);
      entry.label.setVisible(true);
      if (entry.result.pityTriggered) {
        this.addPityFx(entry.slot, entry.label);
      }
      return;
    }
    const rarity = entry.result.reward.rarity;
    this.flipSlot(entry.slot, rarity, rarity === "elite" || rarity === "epic", () => {
      entry.label.setVisible(true);
      if (entry.result.pityTriggered) {
        this.addPityFx(entry.slot, entry.label);
      }
    });
  }

  /** 跳过热区：卷面上方右侧小字；立即补全所有未揭示格。 */
  private createSkipRevealText(panelWidth: number): Phaser.GameObjects.Text {
    const text = this.add.text(panelWidth / 2 - 30, -(SCROLL_RESULT_LAYOUT.paperHeight / 2 + 16), "跳过", {
      color: "#d6c28d",
      fontFamily: FONT_BODY,
      fontSize: "15px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2);
    text.setInteractive({ useHandCursor: true });
    text.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
      event?.stopPropagation();
      this.skipTenReveal();
    });
    return text;
  }

  private skipTenReveal(): void {
    this.revealTimers.forEach((timer) => timer.remove(false));
    this.revealTimers = [];
    this.tenRevealEntries.forEach((_entry, index) => this.revealTenEntry(index, true));
  }

  /** 保底演出：金色粒子尾迹 + 标题金色脉动（承接 scripture_pity_triggered）。 */
  private addPityFx(slot: Phaser.GameObjects.Container, title: Phaser.GameObjects.Text): void {
    title.setTint(0xf6d472);
    this.tweens.add({
      targets: title,
      alpha: 0.55,
      duration: 420,
      yoyo: true,
      repeat: 3,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => title.setAlpha(1)
    });
    JuiceSystem.get(this); // 确保 juice_* 程序化纹理已生成
    if (!this.textures.exists("juice_spark")) {
      return;
    }
    const world = this.getSlotWorldPosition(slot);
    const trail = this.add.particles(world.x, world.y, "juice_spark", {
      speed: { min: 30, max: 90 },
      lifespan: 520,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 110,
      tint: [0xf6d472, 0xfff3c4, 0xa99a20],
      blendMode: Phaser.BlendModes.ADD
    });
    trail.setDepth(85);
    this.time.delayedCall(2800, () => trail.destroy());
  }

  private createResultContinueText(_panelWidth: number): Phaser.GameObjects.Text {
    const text = this.add.text(0, SCROLL_RESULT_LAYOUT.paperHeight / 2 + 12, "继续", {
      color: "#f7f0d0",
      fontFamily: FONT_BODY,
      fontSize: "16px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2);
    text.setInteractive({ useHandCursor: true });
    text.on(Phaser.Input.Events.POINTER_DOWN, () => this.dismissResultPanel());
    return text;
  }

  private registerLayoutTunerTarget<T extends TunableObject>(id: string, target: T, onMove?: (dx: number, dy: number) => void): T {
    if (import.meta.env.DEV) {
      this.pendingLayoutTargets.push({ id, target, onMove });
    }
    return target;
  }

  private toggleLayoutTuner(): void {
    if (!import.meta.env.DEV) {
      return;
    }
    this.layoutTunerEnabled = !this.layoutTunerEnabled;
    if (this.layoutTunerEnabled) {
      this.refreshLayoutTunerOverlay();
      return;
    }
    this.destroyLayoutTunerOverlay();
  }

  private refreshLayoutTunerOverlay(): void {
    this.destroyLayoutTunerOverlay();
    if (!this.layoutTunerEnabled || !import.meta.env.DEV) {
      return;
    }

    const children: Phaser.GameObjects.GameObject[] = [];
    this.layoutTunerInfo = this.add.text(12, 12, "", {
      color: "#f7f0d0",
      backgroundColor: "#102019",
      fontFamily: "monospace",
      fontSize: "13px",
      padding: { x: 8, y: 6 }
    }).setDepth(2001).setScrollFactor(0).setResolution(2);
    children.push(this.layoutTunerInfo);

    this.layoutTunerHandles = [];
    if (!this.resultPanel || this.pendingLayoutTargets.length === 0) {
      this.layoutTunerOverlay = this.add.container(0, 0, children).setDepth(2000);
      this.updateLayoutTunerInfo("F9 Layout Tuner ON | 先按 F7/F8 显示结果");
      return;
    }

    this.pendingLayoutTargets.forEach((entry) => {
      const center = this.getLayoutTargetSceneCenter(entry.target);
      const size = this.getLayoutTargetSize(entry.target);
      const box = this.add.rectangle(center.x, center.y, size.width + 8, size.height + 8, 0x35e7c8, 0.08)
        .setStrokeStyle(1, 0x35e7c8, 0.82)
        .setInteractive({ draggable: true, useHandCursor: true });
      const labelOffsetY = entry.id.endsWith(".row") ? 30 : 14;
      const label = this.add.text(center.x, center.y - size.height / 2 - labelOffsetY, entry.id, {
        color: "#9df4cf",
        backgroundColor: "#102019",
        fontFamily: "monospace",
        fontSize: "10px",
        padding: { x: 3, y: 2 }
      }).setOrigin(0.5).setResolution(2);
      const handle: LayoutTunerHandle = { ...entry, box, label };
      box.on(Phaser.Input.Events.POINTER_DOWN, () => this.selectLayoutHandle(handle));
      box.on(Phaser.Input.Events.DRAG, (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        this.moveLayoutHandleToSceneCenter(handle, dragX, dragY);
        this.selectLayoutHandle(handle);
      });
      this.input.setDraggable(box);
      this.layoutTunerHandles.push(handle);
      children.push(box, label);
    });

    this.layoutTunerOverlay = this.add.container(0, 0, children).setDepth(2000);
    this.updateLayoutTunerInfo("F9 Layout Tuner ON | 拖 ten.row 可移动整排，方向键微调，C=复制 JSON");
  }

  private destroyLayoutTunerOverlay(): void {
    this.layoutTunerOverlay?.destroy(true);
    this.layoutTunerOverlay = undefined;
    this.layoutTunerInfo = undefined;
    this.layoutTunerHandles = [];
    this.selectedLayoutHandle = undefined;
  }

  private selectLayoutHandle(handle: LayoutTunerHandle): void {
    this.selectedLayoutHandle = handle;
    this.layoutTunerHandles.forEach((item) => {
      item.box.setStrokeStyle(item === handle ? 3 : 1, item === handle ? 0xf6d472 : 0x35e7c8, item === handle ? 1 : 0.82);
    });
    this.syncLayoutHandle(handle);
    this.updateLayoutTunerInfo(`${handle.id} x=${roundCoord(handle.target.x)} y=${roundCoord(handle.target.y)} | C=复制 JSON`);
  }

  private nudgeSelectedLayoutTarget(dx: number, dy: number): void {
    if (!this.layoutTunerEnabled || !this.selectedLayoutHandle) {
      return;
    }
    const center = this.getLayoutTargetSceneCenter(this.selectedLayoutHandle.target);
    this.moveLayoutHandleToSceneCenter(this.selectedLayoutHandle, center.x + dx, center.y + dy);
    this.selectLayoutHandle(this.selectedLayoutHandle);
  }

  private moveLayoutHandleToSceneCenter(handle: LayoutTunerHandle, sceneX: number, sceneY: number): void {
    if (!this.resultPanel) {
      return;
    }
    const previousX = handle.target.x;
    const previousY = handle.target.y;
    const size = this.getLayoutTargetSize(handle.target);
    const origin = this.getLayoutTargetOrigin(handle.target);
    const localCenterX = sceneX - this.resultPanel.x;
    const localCenterY = sceneY - this.resultPanel.y;
    handle.target.setPosition(
      localCenterX - size.width * (0.5 - origin.x),
      localCenterY - size.height * (0.5 - origin.y)
    );
    handle.onMove?.(handle.target.x - previousX, handle.target.y - previousY);
    this.syncLayoutHandles();
  }

  private syncLayoutHandle(handle: LayoutTunerHandle): void {
    const center = this.getLayoutTargetSceneCenter(handle.target);
    const size = this.getLayoutTargetSize(handle.target);
    handle.box
      .setPosition(center.x, center.y)
      .setSize(size.width + 8, size.height + 8)
      .setDisplaySize(size.width + 8, size.height + 8);
    const labelOffsetY = handle.id.endsWith(".row") ? 30 : 14;
    handle.label.setPosition(center.x, center.y - size.height / 2 - labelOffsetY);
  }

  private syncLayoutHandles(): void {
    this.layoutTunerHandles.forEach((handle) => this.syncLayoutHandle(handle));
  }

  private getLayoutTargetSceneCenter(target: TunableObject): { x: number; y: number } {
    const size = this.getLayoutTargetSize(target);
    const origin = this.getLayoutTargetOrigin(target);
    const panelX = this.resultPanel?.x ?? 0;
    const panelY = this.resultPanel?.y ?? 0;
    return {
      x: panelX + target.x + size.width * (0.5 - origin.x),
      y: panelY + target.y + size.height * (0.5 - origin.y)
    };
  }

  private getLayoutTargetSize(target: TunableObject): { width: number; height: number } {
    return {
      width: Math.max(18, target.displayWidth),
      height: Math.max(18, target.displayHeight)
    };
  }

  private getLayoutTargetOrigin(target: TunableObject): { x: number; y: number } {
    return {
      x: "originX" in target ? target.originX : 0.5,
      y: "originY" in target ? target.originY : 0.5
    };
  }

  private copyLayoutTunerSnapshot(): void {
    if (!this.layoutTunerEnabled || this.pendingLayoutTargets.length === 0) {
      return;
    }
    const payload = {
      scene: "ScriptureScene",
      resultPanel: {
        x: roundCoord(this.resultPanel?.x ?? 0),
        y: roundCoord(this.resultPanel?.y ?? 0)
      },
      targets: Object.fromEntries(this.pendingLayoutTargets.map(({ id, target }) => [
        id,
        {
          x: roundCoord(target.x),
          y: roundCoord(target.y),
          width: roundCoord(target.displayWidth),
          height: roundCoord(target.displayHeight)
        }
      ]))
    };
    const serialized = JSON.stringify(payload, null, 2);
    console.log("[Scripture Layout Tuner]", serialized);
    void navigator.clipboard?.writeText(serialized).catch(() => undefined);
    this.updateLayoutTunerInfo("已复制/输出 layout JSON 到 console");
  }

  private updateLayoutTunerInfo(message: string): void {
    this.layoutTunerInfo?.setText(message);
  }

  private setStatus(message: string): void {
    if (!this.statusText) {
      return;
    }
    this.statusText.setText(message);
  }

  private returnFromScene(): void {
    getAudioSystem(this).playPlaceholder("ui_click");
    if (this.returnTo === "result") {
      this.scene.start(SCENE_KEYS.result, this.runSummary ?? getRunSummary(this));
      return;
    }
    this.scene.start(SCENE_KEYS.menu);
  }

  private addToContent<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.content?.add(gameObject);
    return gameObject;
  }
}

function getRarityRank(rarity: ScriptureRarity): number {
  switch (rarity) {
    case "epic":
      return 3;
    case "elite":
      return 2;
    case "rare":
      return 1;
    default:
      return 0;
  }
}

function getHighestRarity(results: ScripturePullResult[]): ScriptureRarity {
  let highest: ScriptureRarity = "common";
  results.forEach((result) => {
    if (getRarityRank(result.reward.rarity) > getRarityRank(highest)) {
      highest = result.reward.rarity;
    }
  });
  return highest;
}

function getRevealAudioEvent(results: ScripturePullResult[]): string {
  const highest = getHighestRarity(results);
  if (highest === "elite" || highest === "epic") {
    return "scripture_reveal_epic";
  }
  if (highest === "rare") {
    return "scripture_reveal_rare";
  }
  return "scripture_reveal_common";
}

function rollRarity(): ScriptureRarity {
  const roll = Math.random();
  if (roll < 0.65) {
    return "common";
  }
  if (roll < 0.9) {
    return "rare";
  }
  if (roll < 0.99) {
    return "elite";
  }
  return "epic";
}

function pickRewardByRarity(rarity: ScriptureRarity): ScriptureRewardDefinition {
  const candidates = SCRIPTURE_REWARDS.filter((reward) => reward.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? SCRIPTURE_REWARDS[0];
}

function isDuplicateReward(saveData: SaveData, reward: ScriptureRewardDefinition): boolean {
  if (!reward.collectionKey) {
    return false;
  }
  if (reward.kind === "skin") {
    return saveData.collection.skins.includes(reward.collectionKey);
  }
  if (reward.kind === "title") {
    return saveData.collection.titles.includes(reward.collectionKey);
  }
  return false;
}

function applyReward(saveData: SaveData, reward: ScriptureRewardDefinition): void {
  if (reward.kind === "copper") {
    saveData.copper += reward.amount;
    return;
  }
  if (reward.kind === "fragment" && reward.collectionKey) {
    saveData.collection.fragments[reward.collectionKey] = (saveData.collection.fragments[reward.collectionKey] ?? 0) + reward.amount;
    return;
  }
  if (reward.kind === "skin" && reward.collectionKey && !saveData.collection.skins.includes(reward.collectionKey)) {
    saveData.collection.skins.push(reward.collectionKey);
    return;
  }
  if (reward.kind === "title" && reward.collectionKey && !saveData.collection.titles.includes(reward.collectionKey)) {
    saveData.collection.titles.push(reward.collectionKey);
  }
}

function createCompensation(rarity: ScriptureRarity): ScriptureCompensation {
  if (rarity === "epic") {
      return {
        title: "史诗残页",
        iconKey: "ui_icon_scripture_compensation_fragment",
        amount: 3,
        fragmentKey: "epic_compensation"
      };
  }
  if (rarity === "elite") {
      return {
        title: "心法碎片",
        iconKey: "ui_icon_scripture_compensation_fragment",
        amount: 1,
        fragmentKey: "elite_mind"
      };
  }
  if (rarity === "rare") {
      return {
        title: "稀有残页",
        iconKey: "ui_icon_scripture_compensation_fragment",
        amount: 1,
        fragmentKey: "rare_compensation"
      };
  }
  return {
    title: "铜钱返还",
    iconKey: "ui_icon_scripture_compensation_copper",
    amount: 30,
    copper: 30
  };
}

function applyCompensation(saveData: SaveData, compensation: ScriptureCompensation): void {
  if (compensation.copper) {
    saveData.copper += compensation.copper;
  }
  if (compensation.fragmentKey) {
    saveData.collection.fragments[compensation.fragmentKey] = (saveData.collection.fragments[compensation.fragmentKey] ?? 0) + compensation.amount;
  }
}

function roundCoord(value: number): number {
  return Math.round(value * 10) / 10;
}

function isShiftKeyDown(keyOrEvent?: unknown, event?: KeyboardEvent): boolean {
  const keyboardEvent = event ?? (hasShiftKey(keyOrEvent) ? keyOrEvent : undefined);
  return Boolean(keyboardEvent?.shiftKey);
}

function preventKeyboardDefault(keyOrEvent?: unknown, event?: KeyboardEvent): void {
  const keyboardEvent = event ?? (hasPreventDefault(keyOrEvent) ? keyOrEvent : undefined);
  keyboardEvent?.preventDefault();
}

function hasShiftKey(value: unknown): value is KeyboardEvent {
  return typeof value === "object" && value !== null && "shiftKey" in value;
}

function hasPreventDefault(value: unknown): value is KeyboardEvent {
  return typeof value === "object" && value !== null && "preventDefault" in value;
}

function cloneSaveData(saveData: SaveData): SaveData {
  return {
    ...saveData,
    metaUpgrades: { ...saveData.metaUpgrades },
    scriptureGacha: {
      starter_scripture_pool: { ...saveData.scriptureGacha.starter_scripture_pool }
    },
    collection: {
      skins: [...saveData.collection.skins],
      titles: [...saveData.collection.titles],
      fragments: { ...saveData.collection.fragments }
    },
    settings: { ...saveData.settings }
  };
}
