import Phaser from "phaser";

/**
 * 全局视觉常量 —— 「墨金宣纸」配色体系 + 字体栈。
 * 所有场景/系统统一从这里取色取字，禁止再硬编码 system-ui 与旧森林绿。
 */
export const PALETTE = {
  /** 世界底色：压暗墨绿（替换旧 #33483e 灰绿） */
  worldBg: "#14201b",
  worldBgInt: 0x14201b,
  /** HUD 面板底：墨 */
  panelBg: 0x101010,
  /** 主文本：暖白宣纸 */
  textPrimary: "#f4f3ec",
  /** 次级文本 */
  textSecondary: "#9a958a",
  /** 强调金：哑光芥金（比旧亮金更"古"） */
  accentGold: 0xa99a20,
  accentGoldCss: "#a99a20",
  /** 旧描金（部分面板贴图自带，描边场景可沿用） */
  legacyGold: 0xd6c28d,
  legacyGoldCss: "#d6c28d",
  /** 朱砂：警示 / Boss / 受击 */
  cinnabar: 0xc00000,
  cinnabarCss: "#c00000",
  /** 低血红 */
  lowHp: 0xf1001e,
  lowHpCss: "#f1001e",
  /** 血条绿：竹青系 */
  hp: 0x7d9b76,
  hpCss: "#7d9b76",
  /** 内力青：降饱和 */
  innerPower: 0x2e7f8f,
  innerPowerCss: "#2e7f8f",
  /** 稀有度国风色阶：灰宣 → 竹青 → 芥金 → 朱砂描金 */
  rarity: {
    common: "#b8b3a4",
    rare: "#7d9b76",
    elite: "#a99a20",
    epic: "#c00000"
  } as Record<string, string>,
  rarityInt: {
    common: 0xb8b3a4,
    rare: 0x7d9b76,
    elite: 0xa99a20,
    epic: 0xc00000
  } as Record<string, number>
};

/** 中文标题/书法字（Google Fonts 在 styles.css 中 @import，含系统回退栈） */
export const FONT_TITLE =
  "'Ma Shan Zheng', 'Noto Serif SC', 'PingFang SC', 'Microsoft YaHei', serif";
/** 正文 */
export const FONT_BODY =
  "'Noto Sans SC', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
/** HUD 数字/标签：等宽增强仪表感 */
export const FONT_MONO =
  "'Noto Sans Mono', 'SF Mono', Menlo, Consolas, monospace";

/** 场景淡入（墨黑）。每个 UI 场景 create() 末尾调用一次即可。 */
export function fadeIn(scene: Phaser.Scene, ms = 250): void {
  scene.cameras.main.fadeIn(ms, 10, 10, 10);
}

/**
 * 统一转场：淡出后再 scene.start，替代硬切。
 * 注意：仅适用于 scene.start 语义的场景切换；pause/resume 语义请自行处理。
 */
export function transitionTo(
  scene: Phaser.Scene,
  key: string,
  data?: Record<string, unknown>,
  ms = 200
): void {
  scene.cameras.main.fadeOut(ms, 10, 10, 10);
  scene.cameras.main.once(
    Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
    () => {
      scene.scene.start(key, data);
    }
  );
}
