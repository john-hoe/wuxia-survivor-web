export type BossId = "heifeng_chief";

export type BossState =
  | "pending"
  | "intro"
  | "idle"
  | "choose_attack"
  | "charge_windup"
  | "charge_slash"
  | "whirlwind_windup"
  | "whirlwind"
  | "hurt"
  | "dead"
  | "cleared";

export type BossAttackId = "charge_slash" | "whirlwind_blade";

export type BossAttackConfig = {
  id: BossAttackId;
  displayName: string;
  cooldownMs: number;
  warningMs: number;
  activeMs: number;
  damage: number;
};

export type BossConfig = {
  id: BossId;
  displayName: string;
  maxHp: number;
  moveSpeed: number;
  collisionRadius: number;
  visualRadius: number;
  contactDamage: number;
  spawnSeconds: number;
  copperReward: number;
  introMs: number;
  charge: BossAttackConfig & {
    dashSpeed: number;
    warningWidth: number;
    warningLength: number;
  };
  whirlwind: BossAttackConfig & {
    startRadius: number;
    endRadius: number;
  };
};

export const heifengChiefConfig: BossConfig = {
  id: "heifeng_chief",
  displayName: "黑风寨主",
  maxHp: 4200,
  moveSpeed: 70,
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18,
  spawnSeconds: 360,
  copperReward: 150,
  introMs: 1200,
  charge: {
    id: "charge_slash",
    displayName: "冲撞斩",
    cooldownMs: 5500,
    warningMs: 750,
    activeMs: 550,
    damage: 30,
    dashSpeed: 560,
    warningWidth: 78,
    warningLength: 460
  },
  whirlwind: {
    id: "whirlwind_blade",
    displayName: "旋风刀",
    cooldownMs: 8000,
    warningMs: 900,
    activeMs: 1300,
    damage: 22,
    startRadius: 90,
    endRadius: 310
  }
};
