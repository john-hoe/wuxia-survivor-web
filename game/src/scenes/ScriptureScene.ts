import Phaser from "phaser";
import type { RunSummary, SaveData } from "../types";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { createIconButton, createTextButton, type UiButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getRunSummary, getSaveData, setSaveData } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
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

const RARITY_COLORS: Record<ScriptureRarity, string> = {
  common: "#d8ead9",
  rare: "#99e2ff",
  elite: "#e4b7ff",
  epic: "#f6d472"
};

export class ScriptureScene extends Phaser.Scene {
  private returnTo: "menu" | "result" = "menu";
  private runSummary?: RunSummary;
  private activeView: ScriptureView = "scripture";
  private content?: Phaser.GameObjects.Container;
  private resultPanel?: Phaser.GameObjects.Container;
  private debugOverlay?: Phaser.GameObjects.Container;
  private pullButtons: UiButton[] = [];
  private statusText?: Phaser.GameObjects.Text;
  private resultHiddenObjects: Array<Phaser.GameObjects.Text | UiButton> = [];
  private pendingLayoutTargets: LayoutTunerTarget[] = [];
  private layoutTunerEnabled = false;
  private layoutTunerOverlay?: Phaser.GameObjects.Container;
  private layoutTunerInfo?: Phaser.GameObjects.Text;
  private layoutTunerHandles: LayoutTunerHandle[] = [];
  private selectedLayoutHandle?: LayoutTunerHandle;

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
    this.renderView();
    this.installDebugShowcaseKeys();
  }

  private renderView(): void {
    this.content?.destroy(true);
    this.resultPanel = undefined;
    this.debugOverlay = undefined;
    this.pullButtons = [];
    this.statusText = undefined;
    this.resultHiddenObjects = [];
    this.pendingLayoutTargets = [];
    this.destroyLayoutTunerOverlay();
    this.content = this.add.container(0, 0);

    const centerX = this.scale.width / 2;
    this.addToContent(this.add.rectangle(centerX, this.scale.height / 2, this.scale.width, this.scale.height, 0x1a221b));
    this.addToContent(createArtPanel(this, "ui_panel_pause", centerX, 334, getSafePanelWidth(this, 800), 370, 0x11140f, 0.84));
    this.addCleanPanel(centerX, 334, getSafePanelWidth(this, 700), 314, 0.86);
    this.addToContent(this.add.text(centerX, 56, this.activeView === "meta" ? "局外成长" : "翻阅秘籍", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "36px",
      fontStyle: "bold"
    }).setOrigin(0.5));

    this.addTabButton(356, "局外成长", "meta");
    this.addTabButton(604, "翻阅秘籍", "scripture");
    this.addToContent(createIconButton(this, 848, 54, "ui_icon_back", () => this.returnFromScene()));

    if (this.activeView === "meta") {
      this.drawMetaView();
      return;
    }

    this.drawScriptureView();
  }

  private drawMetaView(): void {
    const saveData = getSaveData(this);
    this.addToContent(this.add.text(this.scale.width / 2, 154, `当前铜钱 ${saveData.copper}`, {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      fontStyle: "bold"
    }).setOrigin(0.5));

    const cardY = 320;
    const cardGap = 226;
    META_UPGRADES.forEach((upgrade, index) => {
      this.addMetaUpgradeCard(upgrade, this.scale.width / 2 + (index - 1) * cardGap, cardY, saveData);
    });
    this.statusText = this.addToContent(this.add.text(this.scale.width / 2, 472, "铜钱只能来自战后清点，局外成长最高 5 级", {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "17px"
    }).setOrigin(0.5));
  }

  private drawScriptureView(): void {
    const saveData = getSaveData(this);
    const pullsUntilPity = Math.max(1, RARE_OR_BETTER_PITY - saveData.scriptureGacha.starter_scripture_pool.pityCounter);
    this.addToContent(this.add.text(this.scale.width / 2, 154, `当前铜钱 ${saveData.copper}    距保底 ${pullsUntilPity} 次`, {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "21px",
      fontStyle: "bold"
    }).setOrigin(0.5));
    this.addIcon("ui_badge_pity", this.scale.width / 2 + 230, 154, 34);

    const probabilityPanelWidth = getSafePanelWidth(this, 600);
    const probabilityPanelY = 236;
    this.addCleanPanel(this.scale.width / 2, probabilityPanelY, probabilityPanelWidth, 132, 0.92, 0x6fcfb8, 0.52);
    this.addProbabilityRows(probabilityPanelWidth, probabilityPanelY, 132);
    const hintText = this.addToContent(this.add.text(this.scale.width / 2, 320, "20 次内至少 1 个精良或以上；收藏重复会转为残页", {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px"
    }).setOrigin(0.5));
    this.resultHiddenObjects.push(hintText);

    const pullOnce = createTextButton(this, 328, 366, "翻阅一次 300 铜钱", () => this.pullScripture(1), 270, 54);
    pullOnce.setEnabled(saveData.copper >= PULL_ONCE_COST);
    const pullTen = createTextButton(this, 632, 366, "翻阅十次 3000 铜钱", () => this.pullScripture(10), 270, 54);
    pullTen.setEnabled(saveData.copper >= PULL_TEN_COST);
    this.pullButtons = [this.addToContent(pullOnce), this.addToContent(pullTen)];
    this.resultHiddenObjects.push(pullOnce, pullTen);

    this.statusText = this.addToContent(this.add.text(this.scale.width / 2, 416, saveData.copper < PULL_ONCE_COST ? "铜钱不足" : "概率公开，只消耗游玩获得的铜钱", {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "17px"
    }).setOrigin(0.5));
    this.resultHiddenObjects.push(this.statusText);
  }

  private addMetaUpgradeCard(upgrade: MetaUpgradeDefinition, x: number, y: number, saveData: SaveData): void {
    const level = saveData.metaUpgrades[upgrade.key];
    const maxLevel = upgrade.costs.length;
    const nextCost = upgrade.costs[level];
    const canBuy = nextCost !== undefined && saveData.copper >= nextCost;

    const card = this.add.rectangle(x, y, 204, 238, 0x0d1712, 0.94).setStrokeStyle(1, 0xd6c28d, 0.64);
    this.addToContent(card);
    this.addIcon(upgrade.iconKey, x, y - 76, 54);
    this.addToContent(this.add.text(x, y - 34, upgrade.title, {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      fontStyle: "bold"
    }).setOrigin(0.5));
    this.addToContent(this.add.text(x, y - 2, `${upgrade.description} ${upgrade.effect}`, {
      color: "#d8ead9",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px"
    }).setOrigin(0.5));
    this.addToContent(this.add.text(x, y + 30, `等级 ${level}/${maxLevel}`, {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      fontStyle: "bold"
    }).setOrigin(0.5));
    this.addToContent(this.add.text(x, y + 60, nextCost === undefined ? "已达上限" : `下一阶 ${nextCost} 铜钱`, {
      color: nextCost === undefined ? "#9fb2a0" : "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px"
    }).setOrigin(0.5));

    const button = createTextButton(this, x, y + 94, nextCost === undefined ? "已满" : "提升", () => this.purchaseMetaUpgrade(upgrade), 144, 44);
    button.setEnabled(canBuy);
    this.addToContent(button);
  }

  private addProbabilityRows(panelWidth: number, panelY: number, panelHeight: number): void {
    const centerX = this.scale.width / 2;
    const dotX = centerX - panelWidth / 2 + 62;
    const rarityX = centerX - panelWidth / 2 + 112;
    const labelX = centerX + 82;
    const rowStartY = panelY - panelHeight / 2 + 28;
    const rows = [
      { rarity: "common" as ScriptureRarity, chance: "普通 65%", label: "残页 / 铜钱返还" },
      { rarity: "rare" as ScriptureRarity, chance: "精良 25%", label: "外观 / 成长碎片" },
      { rarity: "elite" as ScriptureRarity, chance: "上乘 9%", label: "稀有心法碎片" },
      { rarity: "epic" as ScriptureRarity, chance: "绝学 1%", label: "称号卷轴" }
    ];

    rows.forEach((row, index) => {
      const y = rowStartY + index * 26;
      this.addToContent(this.add.circle(dotX, y, 7, Phaser.Display.Color.HexStringToColor(RARITY_COLORS[row.rarity]).color, 0.8));
      this.addToContent(this.add.text(rarityX, y, row.chance, {
        color: RARITY_COLORS[row.rarity],
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        fontStyle: "bold"
      }).setOrigin(0, 0.5));
      this.addToContent(this.add.text(labelX, y, row.label, {
        color: "#d8ead9",
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px"
      }).setOrigin(0, 0.5));
    });
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
    getAudioSystem(this).playPlaceholder("scripture_reveal_common");
    this.renderView();
    this.showResultPanel(results);
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
    this.pendingLayoutTargets = [];
    this.resultHiddenObjects.forEach((gameObject) => gameObject.setVisible(false));
    const isTen = results.length > 1;
    const panelWidth = isTen ? getSafePanelWidth(this, 800) : getSafePanelWidth(this, 640, 80);
    const panelHeight = 140;
    const y = 424;
    const panelKey = isTen ? "ui_panel_scripture_result_ten" : "ui_panel_scripture_result_single";
    const background = this.textures.exists(panelKey)
      ? this.add.image(0, 0, panelKey).setDisplaySize(panelWidth, panelHeight)
      : this.add.rectangle(0, 0, panelWidth, panelHeight, 0x11140f, 0.93).setStrokeStyle(2, 0xd6c28d, 0.72);
    background.setInteractive({ useHandCursor: true });
    background.on(Phaser.Input.Events.POINTER_DOWN, () => this.dismissResultPanel());
    const children: Phaser.GameObjects.GameObject[] = [background];

    if (isTen) {
      children.push(...this.createTenResultCards(results));
    } else {
      children.push(...this.createSingleResultCard(results[0]));
    }
    children.push(this.createResultContinueText(panelWidth));

    this.resultPanel = this.add.container(this.scale.width / 2, y, children);
    this.content?.add(this.resultPanel);
    this.refreshLayoutTunerOverlay();
  }

  private dismissResultPanel(): void {
    this.destroyLayoutTunerOverlay();
    this.resultPanel?.destroy(true);
    this.resultPanel = undefined;
    this.pendingLayoutTargets = [];
    this.resultHiddenObjects.forEach((gameObject) => gameObject.setVisible(true));
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
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "bold"
      }).setOrigin(0.5)
    ];

    items.forEach((item, index) => {
      const x = -320 + index * 80;
      children.push(this.createIconObject(item.key, x, -14, 46));
      children.push(this.add.text(x, 38, item.label, {
        color: "#d8ead9",
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        align: "center"
      }).setOrigin(0.5));
    });

    this.debugOverlay = this.add.container(this.scale.width / 2, 454, children).setDepth(30);
    this.content?.add(this.debugOverlay);
  }

  private createSingleResultCard(result: ScripturePullResult): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    objects.push(this.createTunableRewardSlot("single.rewardSlot", result.reward.iconKey, result.reward.rarity, -261.8, 1.4, 58, 82));

    const rarityText = `${RARITY_LABELS[result.reward.rarity]}  ${result.reward.title} x${result.reward.amount}`;
    objects.push(this.registerLayoutTunerTarget("single.title", this.add.text(-185.7, 0, rarityText, {
      color: RARITY_COLORS[result.reward.rarity],
      fontFamily: "system-ui, sans-serif",
      fontSize: "21px",
      fontStyle: "bold"
    }).setOrigin(0, 0.5)));

    const detail = result.pityTriggered ? "保底触发" : result.duplicate ? "重复奖励" : "已收入收藏";
    objects.push(this.registerLayoutTunerTarget("single.detail", this.add.text(54.9, -12.8, detail, {
      color: "#d6c28d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px"
    }).setOrigin(0, 0.5)));

    if (result.duplicate && result.compensation) {
      objects.push(this.registerLayoutTunerTarget("single.compLabel", this.add.text(58.3, 16.1, "转化补偿", {
        color: "#d8ead9",
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        fontStyle: "bold"
      }).setOrigin(0, 0.5)));
      objects.push(this.registerLayoutTunerTarget("single.compIcon", this.createIconObject(result.compensation.iconKey, 173, 0, 38)));
      objects.push(this.registerLayoutTunerTarget("single.compText", this.add.text(205, 0, `${result.compensation.title} x${result.compensation.amount}`, {
        color: "#f7f0d0",
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px"
      }).setOrigin(0, 0.5)));
    }

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
    objects.push(this.createTunableRewardSlot(`${prefix}.slot`, result.reward.iconKey, result.reward.rarity, slotX, slotY, 40, 52));
    const label = result.duplicate ? "补偿" : result.pityTriggered ? "保底" : RARITY_LABELS[result.reward.rarity];
    objects.push(this.registerLayoutTunerTarget(`${prefix}.label`, this.add.text(labelX, labelY, label, {
      color: result.duplicate || result.pityTriggered ? "#f6d472" : RARITY_COLORS[result.reward.rarity],
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      fontStyle: "bold"
    }).setOrigin(0.5)));
    return objects;
  }

  private addTabButton(x: number, label: string, view: ScriptureView): void {
    const button = createTextButton(this, x, 96, label, () => {
      this.activeView = view;
      this.renderView();
    }, 196, 44);
    button.setAlpha(this.activeView === view ? 1 : 0.7);
    this.addToContent(button);
  }

  private addCleanPanel(x: number, y: number, width: number, height: number, alpha = 0.88, stroke = 0xd6c28d, strokeAlpha = 0.35): Phaser.GameObjects.Rectangle {
    const panel = this.add.rectangle(x, y, width, height, 0x0f1813, alpha).setStrokeStyle(1, stroke, strokeAlpha);
    this.addToContent(panel);
    return panel;
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

  private createCompactRarityFrameObject(rarity: ScriptureRarity, x: number, y: number, size: number): Phaser.GameObjects.Rectangle {
    const color = Phaser.Display.Color.HexStringToColor(RARITY_COLORS[rarity]).color;
    return this.add.rectangle(x, y, size, size, color, 0).setStrokeStyle(2, color, 0.82);
  }

  private createTunableRewardSlot(
    id: string,
    iconKey: string,
    rarity: ScriptureRarity,
    x: number,
    y: number,
    iconSize: number,
    frameSize: number
  ): Phaser.GameObjects.Container {
    const slot = this.add.container(x, y, [
      this.createIconObject(iconKey, 0, 0, iconSize),
      this.createCompactRarityFrameObject(rarity, 0, 0, frameSize)
    ]);
    slot.setSize(frameSize, frameSize);
    return this.registerLayoutTunerTarget(id, slot);
  }

  private createResultContinueText(_panelWidth: number): Phaser.GameObjects.Text {
    const text = this.add.text(0, -84, "继续", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      fontStyle: "bold"
    }).setOrigin(0.5);
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
    }).setDepth(2001).setScrollFactor(0);
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
      }).setOrigin(0.5);
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
