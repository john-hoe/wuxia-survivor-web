import { audioEvents, getStageMusicId, isSampleAudioPath, type AudioEventConfig } from "../data/audio";
import type { GameSettings } from "../types";
import { eventBus } from "../utils/EventBus";

const MAX_SFX_VOICES = 24;
const HIT_JITTER_RATIO = 0.08;
const GENERIC_JITTER_RATIO = 0.05;
const HEARTBEAT_PERIOD_SECONDS = 1;
const EVENT_BY_ID = new Map(audioEvents.map((event) => [event.id, event]));
/**
 * QA-006：旧版 GameScene 硬编码的关卡 BGM key。
 * playMusic 收到该 key 时按当前地图 musicId 重映射；新 key（music_stage_maple 等）与 music_menu 不重映射。
 */
const LEGACY_STAGE_MUSIC_KEY = "music_stage_qingshi";
const DEFAULT_EVENT: AudioEventConfig = {
  id: "unknown",
  path: "procedural:unknown",
  bus: "sfx",
  priority: 1,
  volume: 0.32,
  throttleMs: 80,
  required: false,
  source: "placeholder"
};

type ActiveVoice = {
  id: number;
  eventId: string;
  priority: number;
  startedAtMs: number;
  stopAtMs: number;
  stop: () => void;
};

type PendingMerge = {
  count: number;
  timer: number;
};

type MusicVoice = {
  key: string;
  config: AudioEventConfig;
  token: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

export type AudioDebugSnapshot = {
  activeVoices: number;
  playedCount: number;
  suppressedCount: number;
  lastEventId: string;
  lastSuppressedEventId: string;
  lastSuppressedReason: string;
  voiceBudget: number;
  contextState: AudioContextState | "unavailable";
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
};

let latestAudioSystem: AudioSystem | undefined;

export function getLatestAudioDebugSnapshot(): AudioDebugSnapshot | undefined {
  return latestAudioSystem?.getDebugSnapshot();
}

export function playLatestAudioDebugEvent(eventId: string): boolean {
  return latestAudioSystem?.playPlaceholder(eventId) ?? false;
}

export function updateLatestAudioDebugSettings(settings: Partial<GameSettings>): AudioDebugSnapshot | undefined {
  if (!latestAudioSystem) {
    return undefined;
  }

  latestAudioSystem.updateSettings({
    ...latestAudioSystem.getSettings(),
    ...settings
  });
  return latestAudioSystem.getDebugSnapshot();
}

export class AudioSystem {
  private settings: GameSettings;
  private audioContext?: AudioContext;
  private readonly activeVoices: ActiveVoice[] = [];
  private readonly lastPlayedAtByEvent = new Map<string, number>();
  private readonly pendingMerges = new Map<string, PendingMerge>();
  private nextVoiceId = 0;
  private playedCount = 0;
  private suppressedCount = 0;
  private lastEventId = "none";
  private lastSuppressedEventId = "none";
  private lastSuppressedReason = "none";
  private manuallySuspended = false;
  private lowHpActive = false;
  private heartbeatTimer?: number;
  private heartbeatStopFns: Array<() => void> = [];
  private nextHeartbeatAt = 0;
  private readonly sampleCache = new Map<string, Promise<AudioBuffer | undefined>>();
  private readonly loadedSamples = new Map<string, AudioBuffer>();
  private currentMusic?: MusicVoice;
  private musicToken = 0;
  private desiredMusicKey?: string;
  /** QA-010：首次可信手势解锁后才允许创建 AudioContext（消除控制台 autoplay 警告）。 */
  private gestureUnlocked = false;
  /** QA-006：MenuScene 注入的"当前选关地图 id"解析器；缺失/异常时 playMusic 保留原请求 key。 */
  private stageMapIdResolver?: () => string | undefined;
  private heartbeatSource?: AudioBufferSourceNode;
  private heartbeatGain?: GainNode;

  constructor(settings: GameSettings) {
    this.settings = { ...settings };
    latestAudioSystem = this;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.refreshContinuousGains();
    if (this.isSfxSilent()) {
      this.stopAllVoices();
      this.stopHeartbeat();
      if (!this.manuallySuspended && this.audioContext?.state === "running") {
        void this.audioContext.suspend().catch(() => undefined);
      }
      return;
    }
    if (!this.manuallySuspended && this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch(() => undefined);
    }
    // 取消静音/音量恢复后，若有记录的目标 BGM 且当前未播，恢复播放
    if (this.desiredMusicKey && !this.currentMusic) {
      this.playMusic(this.desiredMusicKey);
    }
    if (this.lowHpActive) {
      this.startHeartbeat();
    }
  }

  /** 设置变化后，把音乐 / 采样心跳这类长循环 voice 的增益平滑对齐到新音量。 */
  private refreshContinuousGains(): void {
    const context = this.audioContext;
    if (!context) {
      return;
    }
    const now = context.currentTime;
    if (this.currentMusic) {
      const target = Math.max(0.0001, this.getEffectiveVolume(this.currentMusic.config));
      this.currentMusic.gain.gain.setTargetAtTime(target, now, 0.12);
    }
    if (this.heartbeatGain) {
      const target = Math.max(0.0001, Math.min(1, this.getEffectiveVolume(this.getEventConfig("low_hp_loop"))));
      this.heartbeatGain.gain.setTargetAtTime(target, now, 0.08);
    }
  }

  setLowHp(active: boolean): void {
    this.lowHpActive = active;
    if (active) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  suspendAll(): void {
    this.manuallySuspended = true;
    this.stopHeartbeat();
    if (this.audioContext?.state === "running") {
      void this.audioContext.suspend().catch(() => undefined);
    }
  }

  resumeAll(): void {
    this.manuallySuspended = false;
    if (this.isSfxSilent()) {
      return;
    }
    if (this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch(() => undefined);
    }
    if (this.lowHpActive) {
      this.startHeartbeat();
    }
  }

  /**
   * QA-006：注册"当前地图 id"解析器（由 MenuScene 在 create 时注入，闭包读全局 registry 存档）。
   * GameScene 仍以旧 key（music_stage_qingshi）请求 BGM 时，playMusic 按解析出的当前地图重映射到该图 musicId。
   */
  setStageMapIdResolver(resolver: () => string | undefined): void {
    this.stageMapIdResolver = resolver;
  }

  unlockFromGesture(): void {
    this.gestureUnlocked = true;
    const context = this.ensureAudioContext();
    if (context?.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    // 手势解锁后预加载全部采样事件，避免首次播放回退 procedural。
    for (const event of audioEvents) {
      if (isSampleAudioPath(event.path)) {
        void this.loadSample(event.path);
      }
    }
    // QA-010：补播手势前记录的目标 BGM（手势前的 playMusic 仅记录 desiredMusicKey、不创建 AudioContext）
    if (this.desiredMusicKey && !this.currentMusic) {
      this.playMusic(this.desiredMusicKey);
    }
  }

  /**
   * 播放循环 BGM（music 总线，淡入 800ms）。
   * 同时只保留一首；同 key 重复调用幂等不重启；采样缺失/解码失败时静默跳过。
   * QA-006：请求 key 为旧版硬编码关卡曲时，按当前地图 musicId 重映射（不改 GameScene 调用侧）。
   * QA-010：首次可信手势前不创建 AudioContext，仅记录目标 key，由 unlockFromGesture 补播。
   */
  playMusic(key: string): void {
    this.playMusicResolved(this.resolveStageMusicKey(key), key);
  }

  /** QA-006：旧版 GameScene 硬编码请求 → 当前地图 musicId；解析器缺失/目标事件异常时回退原 key。 */
  private resolveStageMusicKey(requestedKey: string): string {
    if (requestedKey !== LEGACY_STAGE_MUSIC_KEY) {
      return requestedKey;
    }
    try {
      const mapId = this.stageMapIdResolver?.();
      if (!mapId) {
        return requestedKey;
      }
      const mappedKey = getStageMusicId(mapId);
      const mappedConfig = EVENT_BY_ID.get(mappedKey);
      if (!mappedConfig || mappedConfig.bus !== "music" || !isSampleAudioPath(mappedConfig.path)) {
        return requestedKey;
      }
      return mappedKey;
    } catch {
      return requestedKey;
    }
  }

  private playMusicResolved(resolvedKey: string, fallbackKey: string): void {
    const config = this.getEventConfig(resolvedKey);
    if (config.bus !== "music" || !isSampleAudioPath(config.path)) {
      return;
    }
    // 记录想播的曲子；静音/音量归零时先不播，取消静音后由 updateSettings 恢复
    this.desiredMusicKey = resolvedKey;
    if (this.settings.muted || this.settings.masterVolume <= 0.01 || this.settings.musicVolume <= 0.01) {
      return;
    }
    if (this.currentMusic?.key === resolvedKey) {
      return;
    }
    // QA-010：首次可信手势前不创建 AudioContext（避免 autoplay 警告）；解锁后由 unlockFromGesture 补播
    if (!this.gestureUnlocked && !this.audioContext) {
      return;
    }

    const token = ++this.musicToken;
    this.fadeOutCurrentMusic(400);
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended" && !this.manuallySuspended && !this.settings.muted) {
      void context.resume().catch(() => undefined);
    }

    void this.loadSample(config.path).then((buffer) => {
      if (token !== this.musicToken) {
        return;
      }
      if (!buffer) {
        // QA-006 防御：重映射目标采样缺失/解码失败（如并行代理音频文件未就绪）时回退原始请求 key
        if (fallbackKey !== resolvedKey) {
          this.playMusicResolved(fallbackKey, fallbackKey);
        }
        return;
      }
      const currentContext = this.ensureAudioContext();
      if (!currentContext) {
        return;
      }
      this.startMusicLoop(currentContext, resolvedKey, config, buffer, token);
    });
  }

  /** 停止当前 BGM，默认 500ms 淡出。 */
  stopMusic(fadeMs = 500): void {
    ++this.musicToken;
    this.desiredMusicKey = undefined;
    this.fadeOutCurrentMusic(fadeMs);
  }

  private startMusicLoop(
    context: AudioContext,
    key: string,
    config: AudioEventConfig,
    buffer: AudioBuffer,
    token: number
  ): void {
    this.fadeOutCurrentMusic(400);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    const target = Math.max(0.0001, this.getEffectiveVolume(config));
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(target, now + 0.8);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(now);
    this.currentMusic = { key, config, token, source, gain };
  }

  private fadeOutCurrentMusic(fadeMs: number): void {
    const music = this.currentMusic;
    if (!music) {
      return;
    }
    this.currentMusic = undefined;
    const context = this.audioContext;
    if (context && context.state === "running") {
      const now = context.currentTime;
      music.gain.gain.cancelScheduledValues(now);
      music.gain.gain.setValueAtTime(Math.max(0.0001, music.gain.gain.value), now);
      music.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fadeMs / 1000));
    }
    window.setTimeout(() => {
      try {
        music.source.stop();
      } catch {
        // Source already stopped.
      }
      music.source.disconnect();
      music.gain.disconnect();
    }, fadeMs + 80);
  }

  update(_deltaMs: number): void {
    this.pruneFinishedVoices();
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  getActiveVoices(): number {
    this.pruneFinishedVoices();
    return this.activeVoices.length;
  }

  getDebugSnapshot(): AudioDebugSnapshot {
    this.pruneFinishedVoices();
    return {
      activeVoices: this.activeVoices.length,
      playedCount: this.playedCount,
      suppressedCount: this.suppressedCount,
      lastEventId: this.lastEventId,
      lastSuppressedEventId: this.lastSuppressedEventId,
      lastSuppressedReason: this.lastSuppressedReason,
      voiceBudget: MAX_SFX_VOICES,
      contextState: this.audioContext?.state ?? "unavailable",
      muted: this.settings.muted,
      masterVolume: this.settings.masterVolume,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume
    };
  }

  playPlaceholder(eventId: string): boolean {
    const config = this.getEventConfig(eventId);
    const nowMs = performance.now();
    const effectiveVolume = this.getEffectiveVolume(config);
    if (config.bus === "music") {
      if (isSampleAudioPath(config.path)) {
        this.playMusic(config.id);
        return true;
      }
      this.recordSuppressed(config.id, "music_placeholder_not_implemented");
      return false;
    }
    if (this.settings.muted) {
      this.recordSuppressed(config.id, "muted");
      return false;
    }
    if (effectiveVolume <= 0.01) {
      this.recordSuppressed(config.id, "volume_zero");
      return false;
    }
    if (config.mergeWindowMs !== undefined && config.mergeWindowMs > 0 && config.id.endsWith("pickup")) {
      return this.queueMergedEvent(config, effectiveVolume, nowMs);
    }
    if (this.isThrottled(config, nowMs)) {
      this.recordSuppressed(config.id, "throttled");
      return false;
    }
    if (!this.reserveVoice(config, nowMs)) {
      this.recordSuppressed(config.id, "voice_budget");
      return false;
    }

    this.lastPlayedAtByEvent.set(config.id, nowMs);
    this.playEvent(config, effectiveVolume, nowMs);
    return true;
  }

  private queueMergedEvent(config: AudioEventConfig, effectiveVolume: number, nowMs: number): boolean {
    const pending = this.pendingMerges.get(config.id);
    if (pending) {
      pending.count += 1;
      this.lastPlayedAtByEvent.set(config.id, nowMs);
      return true;
    }

    const entry: PendingMerge = { count: 1, timer: 0 };
    entry.timer = window.setTimeout(() => {
      this.pendingMerges.delete(config.id);
      this.flushMergedEvent(config, entry.count, effectiveVolume);
    }, config.mergeWindowMs ?? 0);
    this.pendingMerges.set(config.id, entry);
    this.lastPlayedAtByEvent.set(config.id, nowMs);
    return true;
  }

  private flushMergedEvent(config: AudioEventConfig, count: number, effectiveVolume: number): void {
    const nowMs = performance.now();
    if (this.isSfxSilent()) {
      this.recordSuppressed(config.id, "muted");
      return;
    }
    if (!this.reserveVoice(config, nowMs)) {
      this.recordSuppressed(config.id, "voice_budget");
      return;
    }

    const extraPicks = Math.max(0, count - 1);
    const pitchRatio = Math.min(1 + extraPicks * 0.07, 1.5);
    const volumeScale = Math.min(1 + extraPicks * 0.15, 1.6);
    this.playEvent(config, effectiveVolume, nowMs, pitchRatio, volumeScale);
  }

  private playEvent(
    config: AudioEventConfig,
    effectiveVolume: number,
    nowMs: number,
    pitchRatio = 1,
    volumeScale = 1
  ): void {
    this.playedCount += 1;
    this.lastEventId = config.id;
    eventBus.emit("audio_event_played", {
      id: config.id,
      activeVoices: this.activeVoices.length,
      priority: config.priority,
      effectiveVolume: Number(Math.min(1, effectiveVolume * volumeScale).toFixed(3))
    });

    const durationMs = getEventDurationMs(config.id);
    try {
      const context = this.ensureAudioContext();
      if (!context) {
        this.trackTimerOnlyVoice(config, durationMs, nowMs);
        return;
      }

      if (context.state === "suspended") {
        void context.resume().catch(() => {
          this.recordSuppressed(config.id, "resume_failed");
        });
      }

      if (isSampleAudioPath(config.path)) {
        const buffer = this.loadedSamples.get(config.path);
        if (buffer) {
          this.playSampleVoice(context, config, buffer, effectiveVolume, nowMs, pitchRatio, volumeScale);
          return;
        }
        // 采样尚未就绪：触发懒加载，本次回退 procedural 合成。
        void this.loadSample(config.path);
      }

      this.synthesizeEvent(context, config.id, effectiveVolume, durationMs, nowMs, pitchRatio, volumeScale);
    } catch {
      this.trackTimerOnlyVoice(config, durationMs, nowMs);
    }
  }

  /** 懒加载采样：fetch + decodeAudioData，结果按 path 缓存；失败缓存 undefined 并永久回退 procedural。 */
  private loadSample(path: string): Promise<AudioBuffer | undefined> {
    const cached = this.sampleCache.get(path);
    if (cached) {
      return cached;
    }

    const promise = (async (): Promise<AudioBuffer | undefined> => {
      try {
        const context = this.ensureAudioContext();
        if (!context) {
          return undefined;
        }
        const response = await fetch(path);
        if (!response.ok) {
          return undefined;
        }
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        this.loadedSamples.set(path, buffer);
        return buffer;
      } catch {
        return undefined;
      }
    })();
    this.sampleCache.set(path, promise);
    return promise;
  }

  /** 播放已解码采样：走与合成相同的 bus 增益、voice 计数与抢占，仅音源换成 AudioBuffer。 */
  private playSampleVoice(
    context: AudioContext,
    config: AudioEventConfig,
    buffer: AudioBuffer,
    effectiveVolume: number,
    nowMs: number,
    pitchRatio: number,
    volumeScale: number
  ): void {
    const jitterRatio =
      1 + (Math.random() * 2 - 1) * (config.id === "hit_light" ? HIT_JITTER_RATIO : GENERIC_JITTER_RATIO);
    const rate = Math.max(0.25, jitterRatio * pitchRatio);
    const volume = Math.min(1, effectiveVolume * volumeScale);
    const startTime = context.currentTime;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, startTime);
    const gain = context.createGain();
    // 极短 attack 避免爆音，随后保持常值增益（采样自带包络）。
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.008);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(startTime);

    const stop = (): void => {
      try {
        source.stop();
      } catch {
        // Source already stopped.
      }
      source.disconnect();
      gain.disconnect();
    };

    const durationMs = Math.max(60, (buffer.duration * 1000) / rate);
    this.trackAudioVoice(config.id, config.priority, durationMs, nowMs, [stop]);
  }

  private isSfxSilent(): boolean {
    return this.settings.muted || this.settings.masterVolume <= 0.01 || this.settings.sfxVolume <= 0.01;
  }

  private getEventConfig(eventId: string): AudioEventConfig {
    return EVENT_BY_ID.get(eventId) ?? {
      ...DEFAULT_EVENT,
      id: eventId,
      path: `procedural:${eventId}`
    };
  }

  private getEffectiveVolume(config: AudioEventConfig): number {
    if (this.settings.muted) {
      return 0;
    }
    const busVolume = config.bus === "music" ? this.settings.musicVolume : this.settings.sfxVolume;
    return clamp01(this.settings.masterVolume) * clamp01(busVolume) * clamp01(config.volume);
  }

  private isThrottled(config: AudioEventConfig, nowMs: number): boolean {
    if (config.throttleMs <= 0) {
      return false;
    }

    const lastPlayedAt = this.lastPlayedAtByEvent.get(config.id);
    return lastPlayedAt !== undefined && nowMs - lastPlayedAt < config.throttleMs;
  }

  private reserveVoice(config: AudioEventConfig, nowMs: number): boolean {
    this.pruneFinishedVoices(nowMs);
    if (this.activeVoices.length < MAX_SFX_VOICES) {
      return true;
    }

    const lowestPriorityVoice = this.activeVoices.reduce((lowest, voice) => {
      if (voice.priority < lowest.priority) {
        return voice;
      }
      if (voice.priority === lowest.priority && voice.startedAtMs < lowest.startedAtMs) {
        return voice;
      }
      return lowest;
    });

    if (lowestPriorityVoice.priority > config.priority) {
      return false;
    }

    lowestPriorityVoice.stop();
    this.finishVoice(lowestPriorityVoice.id);
    return true;
  }

  private ensureAudioContext(): AudioContext | undefined {
    if (this.audioContext?.state === "closed") {
      this.audioContext = undefined;
    }
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextConstructor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      return undefined;
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }

  private synthesizeEvent(
    context: AudioContext,
    eventId: string,
    effectiveVolume: number,
    durationMs: number,
    nowMs: number,
    pitchRatio = 1,
    volumeScale = 1
  ): void {
    const startTime = context.currentTime;
    const stopFns: Array<() => void> = [];
    const jitterRatio =
      1 + (Math.random() * 2 - 1) * (eventId === "hit_light" ? HIT_JITTER_RATIO : GENERIC_JITTER_RATIO);
    const pitch = jitterRatio * pitchRatio;
    const volume = Math.min(1, effectiveVolume * volumeScale);

    const tone = (
      frequency: number,
      durationSeconds: number,
      toneVolume: number,
      type: OscillatorType = "sine",
      delaySeconds = 0,
      endFrequency?: number
    ): void => {
      stopFns.push(
        this.playTone(
          context,
          startTime + delaySeconds,
          frequency * pitch,
          durationSeconds,
          toneVolume,
          type,
          endFrequency !== undefined ? endFrequency * pitch : undefined
        )
      );
    };
    const noise = (
      durationSeconds: number,
      noiseVolume: number,
      delaySeconds = 0,
      filterType: BiquadFilterType = "bandpass",
      frequency = 900
    ): void => {
      stopFns.push(
        this.playNoise(context, startTime + delaySeconds, durationSeconds, noiseVolume, filterType, frequency * pitch)
      );
    };

    switch (eventId) {
      case "ui_click":
        tone(720, 0.07, volume, "triangle", 0, 980);
        break;
      case "menu_open":
      case "result_open":
        tone(392, 0.12, volume * 0.45, "triangle", 0, 523);
        tone(659, 0.18, volume * 0.38, "sine", 0.08, 784);
        break;
      case "pause_toggle":
        tone(440, 0.06, volume * 0.5, "triangle", 0);
        tone(330, 0.08, volume * 0.44, "triangle", 0.06);
        break;
      case "skill_cast":
        noise(0.08, volume * 0.55, 0, "highpass", 1200);
        tone(620, 0.1, volume * 0.34, "sine", 0, 760);
        break;
      case "skill_cast_advanced":
        noise(0.1, volume * 0.55, 0, "highpass", 1300);
        tone(523, 0.09, volume * 0.34, "triangle", 0);
        tone(784, 0.12, volume * 0.32, "sine", 0.06);
        break;
      case "hit_light":
        noise(0.055, volume * 0.5, 0, "highpass", 1600);
        tone(1050, 0.045, volume * 0.28, "square", 0);
        tone(120, 0.03, volume * 0.5, "sine", 0, 60);
        break;
      case "enemy_die":
        noise(0.16, volume * 0.42, 0, "lowpass", 580);
        tone(260, 0.16, volume * 0.34, "sawtooth", 0, 120);
        break;
      case "heal_pickup":
        tone(523, 0.11, volume * 0.4, "sine", 0, 659);
        tone(784, 0.15, volume * 0.3, "sine", 0.08, 988);
        break;
      case "inner_power_pickup":
        tone(659, 0.06, volume * 0.38, "triangle", 0);
        tone(880, 0.06, volume * 0.34, "triangle", 0.05);
        tone(1319, 0.1, volume * 0.28, "triangle", 0.1);
        break;
      case "copper_gain":
        tone(2093, 0.05, volume * 0.3, "square", 0, 1976);
        tone(3136, 0.045, volume * 0.18, "square", 0.012);
        noise(0.035, volume * 0.22, 0, "highpass", 3800);
        break;
      case "hero_hurt":
        noise(0.18, volume * 0.62, 0, "bandpass", 420);
        tone(170, 0.22, volume * 0.42, "sawtooth", 0, 95);
        break;
      case "hero_die":
        tone(196, 0.35, volume * 0.55, "triangle", 0, 116);
        tone(147, 0.46, volume * 0.42, "sine", 0.22, 82);
        noise(0.35, volume * 0.2, 0.12, "lowpass", 360);
        break;
      case "insight":
        tone(392, 0.16, volume * 0.36, "sine", 0);
        tone(523, 0.18, volume * 0.34, "sine", 0.12);
        tone(784, 0.28, volume * 0.28, "sine", 0.24);
        noise(0.32, volume * 0.18, 0.06, "highpass", 1500);
        break;
      case "skill_advance":
        tone(262, 0.16, volume * 0.32, "triangle", 0);
        tone(392, 0.18, volume * 0.34, "triangle", 0.14);
        tone(659, 0.32, volume * 0.34, "sine", 0.3);
        noise(0.4, volume * 0.22, 0.08, "bandpass", 900);
        break;
      case "elite_warning":
        tone(220, 0.11, volume * 0.42, "square", 0);
        tone(220, 0.11, volume * 0.42, "square", 0.2);
        tone(330, 0.12, volume * 0.36, "triangle", 0.4);
        break;
      case "boss_intro":
        tone(98, 0.3, volume * 0.55, "sawtooth", 0);
        tone(130, 0.36, volume * 0.42, "triangle", 0.28);
        noise(0.45, volume * 0.32, 0.06, "lowpass", 260);
        break;
      case "boss_warning":
        tone(164, 0.14, volume * 0.54, "square", 0);
        tone(247, 0.16, volume * 0.44, "square", 0.18);
        break;
      case "boss_hit":
        noise(0.08, volume * 0.48, 0, "bandpass", 520);
        tone(210, 0.1, volume * 0.28, "triangle", 0, 140);
        break;
      case "boss_defeated":
        tone(196, 0.2, volume * 0.36, "triangle", 0);
        tone(294, 0.24, volume * 0.38, "triangle", 0.18);
        tone(392, 0.42, volume * 0.38, "sine", 0.38);
        noise(0.38, volume * 0.18, 0.2, "bandpass", 720);
        break;
      case "scripture_reveal_rare":
        tone(523, 0.16, volume * 0.34, "sine", 0);
        tone(784, 0.26, volume * 0.34, "sine", 0.14);
        noise(0.24, volume * 0.16, 0.06, "highpass", 1800);
        break;
      case "scripture_reveal_epic":
        tone(392, 0.16, volume * 0.34, "triangle", 0);
        tone(587, 0.2, volume * 0.36, "triangle", 0.16);
        tone(880, 0.36, volume * 0.32, "sine", 0.34);
        noise(0.32, volume * 0.2, 0.1, "bandpass", 1200);
        break;
      case "scripture_reveal_common":
      default:
        tone(440, 0.14, volume * 0.36, "triangle", 0);
        tone(660, 0.16, volume * 0.26, "sine", 0.1);
        break;
    }

    this.trackAudioVoice(eventId, EVENT_BY_ID.get(eventId)?.priority ?? DEFAULT_EVENT.priority, durationMs, nowMs, stopFns);
  }

  private playTone(
    context: AudioContext,
    startTime: number,
    frequency: number,
    durationSeconds: number,
    volume: number,
    type: OscillatorType,
    endFrequency?: number
  ): () => void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + durationSeconds);
    }
    applyEnvelope(gain.gain, startTime, durationSeconds, volume);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds + 0.03);

    return () => {
      try {
        oscillator.stop();
      } catch {
        // Source already stopped.
      }
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private playNoise(
    context: AudioContext,
    startTime: number,
    durationSeconds: number,
    volume: number,
    filterType: BiquadFilterType,
    frequency: number
  ): () => void {
    const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = 1 - index / frameCount;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, startTime);
    applyEnvelope(gain.gain, startTime, durationSeconds, volume);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(startTime);
    source.stop(startTime + durationSeconds + 0.02);

    return () => {
      try {
        source.stop();
      } catch {
        // Source already stopped.
      }
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private startHeartbeat(): void {
    if (
      this.heartbeatSource !== undefined ||
      this.heartbeatTimer !== undefined ||
      !this.lowHpActive ||
      this.manuallySuspended ||
      this.isSfxSilent()
    ) {
      return;
    }
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const heartbeatPath = this.getEventConfig("low_hp_loop").path;
    if (isSampleAudioPath(heartbeatPath)) {
      const buffer = this.loadedSamples.get(heartbeatPath);
      if (buffer) {
        this.startSampleHeartbeat(context, buffer);
        return;
      }
      // 采样未就绪：先走合成心跳，解码完成后无缝切换为采样循环。
      void this.loadSample(heartbeatPath).then((loaded) => {
        if (
          !loaded ||
          !this.lowHpActive ||
          this.manuallySuspended ||
          this.isSfxSilent() ||
          this.heartbeatSource !== undefined ||
          this.heartbeatTimer === undefined
        ) {
          return;
        }
        const currentContext = this.ensureAudioContext();
        if (!currentContext) {
          return;
        }
        this.stopProceduralHeartbeat();
        this.startSampleHeartbeat(currentContext, loaded);
      });
    }

    this.nextHeartbeatAt = context.currentTime + 0.1;
    this.heartbeatTimer = window.setInterval(() => this.scheduleHeartbeat(), 120);
    this.scheduleHeartbeat();
  }

  /** 采样心跳：heartbeat.ogg 循环播放，音量取 low_hp_loop 事件配置 × sfx 总线。 */
  private startSampleHeartbeat(context: AudioContext, buffer: AudioBuffer): void {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    const volume = Math.max(0.0001, Math.min(1, this.getEffectiveVolume(this.getEventConfig("low_hp_loop"))));
    gain.gain.setValueAtTime(volume, context.currentTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    this.heartbeatSource = source;
    this.heartbeatGain = gain;
  }

  private stopProceduralHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const stop of this.heartbeatStopFns.splice(0)) {
      stop();
    }
  }

  private scheduleHeartbeat(): void {
    const context = this.audioContext;
    if (!context || context.state !== "running") {
      return;
    }
    if (this.nextHeartbeatAt < context.currentTime + 0.05) {
      this.nextHeartbeatAt = context.currentTime + 0.05;
    }
    while (this.nextHeartbeatAt < context.currentTime + 0.5) {
      this.scheduleHeartbeatBeat(context, this.nextHeartbeatAt);
      this.nextHeartbeatAt += HEARTBEAT_PERIOD_SECONDS;
    }
  }

  private scheduleHeartbeatBeat(context: AudioContext, startTime: number): void {
    const volume = Math.min(1, this.getEffectiveVolume(this.getEventConfig("low_hp_loop")));
    if (volume <= 0.01) {
      return;
    }

    this.heartbeatStopFns.push(this.playHeartbeatThump(context, startTime, 78, 58, 0.16, volume));
    this.heartbeatStopFns.push(this.playHeartbeatThump(context, startTime + 0.18, 64, 50, 0.13, volume * 0.7));
    while (this.heartbeatStopFns.length > 8) {
      this.heartbeatStopFns.shift();
    }
  }

  private playHeartbeatThump(
    context: AudioContext,
    startTime: number,
    frequency: number,
    endFrequency: number,
    durationSeconds: number,
    volume: number
  ): () => void {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + durationSeconds);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, startTime);
    applyEnvelope(gain.gain, startTime, durationSeconds, volume);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds + 0.03);

    return () => {
      try {
        oscillator.stop();
      } catch {
        // Source already stopped.
      }
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private stopHeartbeat(): void {
    this.stopProceduralHeartbeat();
    if (this.heartbeatSource) {
      try {
        this.heartbeatSource.stop();
      } catch {
        // Source already stopped.
      }
      this.heartbeatSource.disconnect();
      this.heartbeatSource = undefined;
    }
    if (this.heartbeatGain) {
      this.heartbeatGain.disconnect();
      this.heartbeatGain = undefined;
    }
  }

  private trackAudioVoice(
    eventId: string,
    priority: number,
    durationMs: number,
    nowMs: number,
    stopFns: Array<() => void>
  ): void {
    const voiceId = ++this.nextVoiceId;
    const voice: ActiveVoice = {
      id: voiceId,
      eventId,
      priority,
      startedAtMs: nowMs,
      stopAtMs: nowMs + durationMs + 120,
      stop: () => {
        for (const stop of stopFns) {
          stop();
        }
      }
    };
    this.activeVoices.push(voice);
    window.setTimeout(() => {
      if (this.hasVoice(voiceId)) {
        voice.stop();
      }
      this.finishVoice(voiceId);
    }, durationMs + 180);
  }

  private trackTimerOnlyVoice(config: AudioEventConfig, durationMs: number, nowMs: number): void {
    const voiceId = ++this.nextVoiceId;
    const voice: ActiveVoice = {
      id: voiceId,
      eventId: config.id,
      priority: config.priority,
      startedAtMs: nowMs,
      stopAtMs: nowMs + durationMs + 120,
      stop: () => undefined
    };
    this.activeVoices.push(voice);
    window.setTimeout(() => this.finishVoice(voiceId), durationMs + 180);
  }

  private hasVoice(voiceId: number): boolean {
    return this.activeVoices.some((voice) => voice.id === voiceId);
  }

  private finishVoice(voiceId: number): void {
    const index = this.activeVoices.findIndex((voice) => voice.id === voiceId);
    if (index === -1) {
      return;
    }

    this.activeVoices.splice(index, 1);
  }

  private pruneFinishedVoices(nowMs = performance.now()): void {
    for (let index = this.activeVoices.length - 1; index >= 0; index -= 1) {
      if (this.activeVoices[index].stopAtMs <= nowMs) {
        this.activeVoices[index].stop();
        this.activeVoices.splice(index, 1);
      }
    }
  }

  private stopAllVoices(): void {
    for (const voice of [...this.activeVoices]) {
      voice.stop();
      this.finishVoice(voice.id);
    }
  }

  private recordSuppressed(eventId: string, reason: string): void {
    this.suppressedCount += 1;
    this.lastSuppressedEventId = eventId;
    this.lastSuppressedReason = reason;
    eventBus.emit("audio_event_suppressed", {
      id: eventId,
      reason,
      activeVoices: this.activeVoices.length
    });
  }
}

function applyEnvelope(param: AudioParam, startTime: number, durationSeconds: number, volume: number): void {
  const attackSeconds = Math.min(0.018, durationSeconds * 0.32);
  const releaseStart = startTime + Math.max(attackSeconds + 0.01, durationSeconds * 0.62);
  const endTime = startTime + durationSeconds;
  const safeVolume = Math.max(0.0001, volume);
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(0.0001, startTime);
  param.linearRampToValueAtTime(safeVolume, startTime + attackSeconds);
  param.exponentialRampToValueAtTime(Math.max(0.0001, safeVolume * 0.35), releaseStart);
  param.exponentialRampToValueAtTime(0.0001, endTime);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function getEventDurationMs(eventId: string): number {
  switch (eventId) {
    case "ui_click":
      return 90;
    case "pause_toggle":
      return 150;
    case "hit_light":
      return 80;
    case "skill_cast":
      return 120;
    case "skill_cast_advanced":
      return 180;
    case "enemy_die":
      return 210;
    case "inner_power_pickup":
      return 200;
    case "heal_pickup":
      return 230;
    case "copper_gain":
      return 100;
    case "hero_hurt":
      return 280;
    case "hero_die":
      return 850;
    case "insight":
      return 720;
    case "skill_advance":
      return 950;
    case "elite_warning":
      return 620;
    case "boss_intro":
      return 1250;
    case "boss_warning":
      return 480;
    case "boss_hit":
      return 150;
    case "boss_defeated":
      return 1080;
    case "result_open":
    case "scripture_reveal_common":
      return 520;
    case "scripture_reveal_rare":
      return 720;
    case "scripture_reveal_epic":
      return 1040;
    default:
      return 180;
  }
}
