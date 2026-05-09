import Phaser from "phaser";
import type { DebugSnapshot } from "../types";
import { setLatestDebugSnapshot } from "../utils/debugHooks";

export class DebugPanel {
  private readonly leftText: Phaser.GameObjects.Text;
  private readonly rightText: Phaser.GameObjects.Text;
  private visible = true;

  constructor(scene: Phaser.Scene, x = 16, y = 96, visible = true) {
    this.leftText = scene.add.text(x, y, "", {
      color: "#d7f7d1",
      fontFamily: "monospace",
      fontSize: "12px",
      lineSpacing: 0
    });
    this.rightText = scene.add.text(x + 228, y, "", {
      color: "#d7f7d1",
      fontFamily: "monospace",
      fontSize: "12px",
      lineSpacing: 0
    });
    this.leftText.setDepth(1000);
    this.rightText.setDepth(1000);
    this.leftText.setScrollFactor(0);
    this.rightText.setScrollFactor(0);
    this.leftText.setAlpha(0.88);
    this.rightText.setAlpha(0.88);
    this.setVisible(visible);
  }

  update(snapshot: DebugSnapshot): void {
    setLatestDebugSnapshot(snapshot);
    if (!this.visible) {
      return;
    }

    this.leftText.setText([
      `fps: ${snapshot.fps}`,
      `scene: ${snapshot.scene}`,
      `screenState: ${snapshot.screenState}`,
      `heroX: ${snapshot.heroX}`,
      `heroY: ${snapshot.heroY}`,
      `heroHp: ${snapshot.heroHp}`,
      `heroMaxHp: ${snapshot.heroMaxHp}`,
      `heroLevel: ${snapshot.heroLevel}`,
      `heroSpeed: ${snapshot.heroSpeed}`,
      `heroVelocityX: ${snapshot.heroVelocityX}`,
      `heroVelocityY: ${snapshot.heroVelocityY}`,
      `heroVelocityMagnitude: ${snapshot.heroVelocityMagnitude}`,
      `inputX: ${snapshot.inputX}`,
      `inputY: ${snapshot.inputY}`,
      `inputMagnitude: ${snapshot.inputMagnitude}`,
      `inputSource: ${snapshot.inputSource}`,
      `innerPower: ${snapshot.innerPower}`,
      `nextRequired: ${snapshot.nextRequired}`,
      `insightCount: ${snapshot.insightCount}`,
      `lastInsightAt: ${snapshot.lastInsightAt}`,
      `pendingInsight: ${snapshot.pendingInsight}`,
      `invincibleMs: ${snapshot.invincibleMs}`,
      `isLowHp: ${snapshot.isLowHp}`,
      `lastDamageSource: ${snapshot.lastDamageSource}`,
      `footHpBarVisible: ${snapshot.footHpBarVisible}`,
      `hudSafeRadiusPx: ${snapshot.hudSafeRadiusPx}`,
      `originRebaseCount: ${snapshot.originRebaseCount}`
    ]);

    this.rightText.setText([
      `enemiesAlive: ${snapshot.enemiesAlive}`,
      `enemiesAliveByType: ${JSON.stringify(snapshot.enemiesAliveByType)}`,
      `targetAlive: ${snapshot.targetAliveMin}-${snapshot.targetAlive}`,
      `rawTargetAlive: ${snapshot.rawTargetAliveMin}-${snapshot.rawTargetAliveMax}`,
      `aliveCap: ${snapshot.aliveCap}`,
      `rawAliveCap: ${snapshot.rawAliveCap}`,
      `platformClamp: ${snapshot.platformClamp}`,
      `spawnIntervalMs: ${snapshot.spawnIntervalMs}`,
      `lastSpawnSide: ${snapshot.lastSpawnSide}`,
      `sameSpawnSideStreak: ${snapshot.sameSpawnSideStreak}`,
      `lastSpawnDistanceFromHero: ${snapshot.lastSpawnDistanceFromHero}`,
      `minSpawnDistanceLast30s: ${snapshot.minSpawnDistanceLast30s}`,
      `despawnCountLast10s: ${snapshot.despawnCountLast10s}`,
      `eliteAlive: ${snapshot.eliteAlive}`,
      `nextEliteSeconds: ${snapshot.nextEliteSeconds}`,
      `bossRequestEmitted: ${snapshot.bossRequestEmitted}`,
      `skills: ${snapshot.skills}`,
      `projectilesAlive: ${snapshot.projectilesAlive}`,
      `orbitalsAlive: ${snapshot.orbitalsAlive}`,
      `skillHitsLast10s: ${snapshot.skillHitsLast10s}`,
      `skillDpsLast10s: ${snapshot.skillDpsLast10s}`,
      `advancedSkills: ${snapshot.advancedSkills}`,
      `gemsAlive: ${snapshot.gemsAlive}`,
      `activeVfx: ${snapshot.activeVfx}`,
      `audioVoices: ${snapshot.audioVoices}`,
      `waveTimeSeconds: ${snapshot.waveTimeSeconds}`,
      `directorState: ${snapshot.directorState}`,
      `bossState: ${snapshot.bossState}`,
      `bossHp: ${snapshot.bossHp}`,
      `bossHpPercent: ${snapshot.bossHpPercent}`,
      `currentAttack: ${snapshot.currentAttack}`,
      `nextChargeSeconds: ${snapshot.nextChargeSeconds}`,
      `nextWhirlwindSeconds: ${snapshot.nextWhirlwindSeconds}`,
      `lastWarningDuration: ${snapshot.lastWarningDuration}`,
      `lastAttackDamage: ${snapshot.lastAttackDamage}`,
      `bossAliveSeconds: ${snapshot.bossAliveSeconds}`,
      `bossHitCount: ${snapshot.bossHitCount}`,
      `bossAttacksUsed: ${snapshot.bossAttacksUsed}`,
      `stageCleared: ${snapshot.stageCleared}`,
      `stageId: ${snapshot.stageId}`,
      `loadedChunkCount: ${snapshot.loadedChunkCount}`,
      `qualityScale: ${snapshot.qualityScale}`,
      `missingRequiredAssets: ${snapshot.missingRequiredAssets}`,
      `missingRequiredAudioEvents: ${snapshot.missingRequiredAudioEvents}`,
      `saveStatus: ${snapshot.saveStatus}`,
      `configStatus: ${snapshot.configStatus}`,
      `loadedConfigCount: ${snapshot.loadedConfigCount}`,
      `eventHistoryCount: ${snapshot.eventHistoryCount}`,
      `lastEventName: ${snapshot.lastEventName}`
    ]);
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.leftText.setVisible(visible);
    this.rightText.setVisible(visible);
  }
}
