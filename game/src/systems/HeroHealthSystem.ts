import { eventBus } from "../utils/EventBus";

const INVINCIBLE_DURATION_MS = 600;
const FOOT_HP_BAR_DURATION_MS = 2000;
const LOW_HP_RATIO = 0.25;
const FOOT_HP_BAR_RATIO = 0.3;

export type HeroHealthSnapshot = {
  hp: number;
  maxHp: number;
  hpRatio: number;
  invincibleMs: number;
  isLowHp: boolean;
  isDead: boolean;
  lastDamageSource: string;
  footHpBarVisible: boolean;
};

export type DamageResult = {
  damaged: boolean;
  died: boolean;
  ignoredByInvincible: boolean;
};

export class HeroHealthSystem {
  private hp: number;
  private invincibleMs = 0;
  private footHpBarMs = 0;
  private lastDamageSource = "none";
  private lowHpStartedEmitted = false;
  private dead = false;

  constructor(private maxHp = 100) {
    this.hp = maxHp;
  }

  update(deltaMs: number): HeroHealthSnapshot {
    this.updateInvincible(deltaMs);
    this.footHpBarMs = Math.max(0, this.footHpBarMs - deltaMs);
    return this.getSnapshot();
  }

  damage(amount: number, source: string): DamageResult {
    if (this.dead) {
      return { damaged: false, died: true, ignoredByInvincible: false };
    }

    if (this.invincibleMs > 0) {
      return { damaged: false, died: false, ignoredByInvincible: true };
    }

    const damageAmount = Math.max(0, Math.floor(amount));
    if (damageAmount <= 0) {
      return { damaged: false, died: false, ignoredByInvincible: false };
    }

    this.hp = Math.max(0, this.hp - damageAmount);
    this.lastDamageSource = source;
    this.footHpBarMs = FOOT_HP_BAR_DURATION_MS;

    eventBus.emit("hero_damaged", {
      source,
      amount: damageAmount,
      hp: this.hp,
      maxHp: this.maxHp
    });

    this.emitLowHpIfNeeded();

    if (this.hp <= 0) {
      this.dead = true;
      this.invincibleMs = 0;
      eventBus.emit("hero_died", {
        source,
        hp: this.hp,
        maxHp: this.maxHp
      });
      return { damaged: true, died: true, ignoredByInvincible: false };
    }

    this.invincibleMs = INVINCIBLE_DURATION_MS;
    eventBus.emit("hero_invincible_started", {
      durationMs: INVINCIBLE_DURATION_MS,
      source
    });
    return { damaged: true, died: false, ignoredByInvincible: false };
  }

  heal(amount: number): boolean {
    if (this.dead) {
      return false;
    }

    const healAmount = Math.max(0, Math.floor(amount));
    if (healAmount <= 0 || this.hp >= this.maxHp) {
      return false;
    }

    const previousHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + healAmount);
    this.footHpBarMs = FOOT_HP_BAR_DURATION_MS;

    if (!this.isLowHp()) {
      this.lowHpStartedEmitted = false;
    }

    eventBus.emit("hero_healed", {
      amount: this.hp - previousHp,
      hp: this.hp,
      maxHp: this.maxHp
    });
    return true;
  }

  increaseMaxHp(amount: number): HeroHealthSnapshot {
    if (this.dead) {
      return this.getSnapshot();
    }

    const increase = Math.max(0, Math.floor(amount));
    if (increase <= 0) {
      return this.getSnapshot();
    }

    this.maxHp += increase;
    this.hp += increase;
    this.footHpBarMs = FOOT_HP_BAR_DURATION_MS;
    return this.getSnapshot();
  }

  getSnapshot(): HeroHealthSnapshot {
    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      hpRatio,
      invincibleMs: Math.ceil(this.invincibleMs),
      isLowHp: this.isLowHp(),
      isDead: this.dead,
      lastDamageSource: this.lastDamageSource,
      footHpBarVisible: this.footHpBarMs > 0 || (hpRatio <= FOOT_HP_BAR_RATIO && this.hp < this.maxHp)
    };
  }

  private updateInvincible(deltaMs: number): void {
    if (this.invincibleMs <= 0) {
      return;
    }

    this.invincibleMs = Math.max(0, this.invincibleMs - deltaMs);
    if (this.invincibleMs <= 0) {
      eventBus.emit("hero_invincible_ended", {});
    }
  }

  private emitLowHpIfNeeded(): void {
    if (!this.isLowHp() || this.lowHpStartedEmitted) {
      return;
    }

    this.lowHpStartedEmitted = true;
    eventBus.emit("hero_low_hp_started", {
      hp: this.hp,
      maxHp: this.maxHp
    });
  }

  private isLowHp(): boolean {
    return this.maxHp > 0 && this.hp / this.maxHp < LOW_HP_RATIO;
  }
}
