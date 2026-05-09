import { audioEvents, type AudioEventConfig } from "../data/audio";
import type { GameSettings } from "../types";
import { eventBus } from "../utils/EventBus";

const MAX_SFX_VOICES = 24;
const EVENT_BY_ID = new Map(audioEvents.map((event) => [event.id, event]));
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
  private nextVoiceId = 0;
  private playedCount = 0;
  private suppressedCount = 0;
  private lastEventId = "none";
  private lastSuppressedEventId = "none";
  private lastSuppressedReason = "none";

  constructor(settings: GameSettings) {
    this.settings = { ...settings };
    latestAudioSystem = this;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = { ...settings };
    if (this.settings.muted || this.settings.masterVolume <= 0.01 || this.settings.sfxVolume <= 0.01) {
      this.stopAllVoices();
    }
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
    if (this.isThrottled(config, nowMs)) {
      this.recordSuppressed(config.id, "throttled");
      return false;
    }
    if (!this.reserveVoice(config, nowMs)) {
      this.recordSuppressed(config.id, "voice_budget");
      return false;
    }

    this.lastPlayedAtByEvent.set(config.id, nowMs);
    this.playedCount += 1;
    this.lastEventId = config.id;
    eventBus.emit("audio_event_played", {
      id: config.id,
      activeVoices: this.activeVoices.length,
      priority: config.priority,
      effectiveVolume: Number(effectiveVolume.toFixed(3))
    });

    const durationMs = getEventDurationMs(config.id);
    try {
      const context = this.ensureAudioContext();
      if (!context) {
        this.trackTimerOnlyVoice(config, durationMs, nowMs);
        return true;
      }

      if (context.state === "suspended") {
        void context.resume().catch(() => {
          this.recordSuppressed(config.id, "resume_failed");
        });
      }

      this.synthesizeEvent(context, config.id, effectiveVolume, durationMs, nowMs);
      return true;
    } catch {
      this.trackTimerOnlyVoice(config, durationMs, nowMs);
      return true;
    }
  }

  private getEventConfig(eventId: string): AudioEventConfig {
    return EVENT_BY_ID.get(eventId) ?? {
      ...DEFAULT_EVENT,
      id: eventId,
      path: `procedural:${eventId}`
    };
  }

  private getEffectiveVolume(config: AudioEventConfig): number {
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
    nowMs: number
  ): void {
    const startTime = context.currentTime;
    const stopFns: Array<() => void> = [];

    const tone = (
      frequency: number,
      durationSeconds: number,
      volume: number,
      type: OscillatorType = "sine",
      delaySeconds = 0,
      endFrequency?: number
    ): void => {
      stopFns.push(this.playTone(context, startTime + delaySeconds, frequency, durationSeconds, volume, type, endFrequency));
    };
    const noise = (
      durationSeconds: number,
      volume: number,
      delaySeconds = 0,
      filterType: BiquadFilterType = "bandpass",
      frequency = 900
    ): void => {
      stopFns.push(this.playNoise(context, startTime + delaySeconds, durationSeconds, volume, filterType, frequency));
    };

    switch (eventId) {
      case "ui_click":
        tone(720, 0.07, effectiveVolume, "triangle", 0, 980);
        break;
      case "menu_open":
      case "result_open":
        tone(392, 0.12, effectiveVolume * 0.45, "triangle", 0, 523);
        tone(659, 0.18, effectiveVolume * 0.38, "sine", 0.08, 784);
        break;
      case "pause_toggle":
        tone(440, 0.06, effectiveVolume * 0.5, "triangle", 0);
        tone(330, 0.08, effectiveVolume * 0.44, "triangle", 0.06);
        break;
      case "skill_cast":
        noise(0.08, effectiveVolume * 0.55, 0, "highpass", 1200);
        tone(620, 0.1, effectiveVolume * 0.34, "sine", 0, 760);
        break;
      case "skill_cast_advanced":
        noise(0.1, effectiveVolume * 0.55, 0, "highpass", 1300);
        tone(523, 0.09, effectiveVolume * 0.34, "triangle", 0);
        tone(784, 0.12, effectiveVolume * 0.32, "sine", 0.06);
        break;
      case "hit_light":
        noise(0.055, effectiveVolume * 0.5, 0, "highpass", 1600);
        tone(1050, 0.045, effectiveVolume * 0.28, "square", 0);
        break;
      case "enemy_die":
        noise(0.16, effectiveVolume * 0.42, 0, "lowpass", 580);
        tone(260, 0.16, effectiveVolume * 0.34, "sawtooth", 0, 120);
        break;
      case "inner_power_pickup":
      case "copper_gain":
      case "heal_pickup":
        tone(880, 0.08, effectiveVolume * 0.38, "sine", 0, 1320);
        tone(1320, 0.1, effectiveVolume * 0.24, "sine", 0.05, 1760);
        break;
      case "hero_hurt":
        noise(0.18, effectiveVolume * 0.62, 0, "bandpass", 420);
        tone(170, 0.22, effectiveVolume * 0.42, "sawtooth", 0, 95);
        break;
      case "hero_die":
        tone(196, 0.35, effectiveVolume * 0.55, "triangle", 0, 116);
        tone(147, 0.46, effectiveVolume * 0.42, "sine", 0.22, 82);
        noise(0.35, effectiveVolume * 0.2, 0.12, "lowpass", 360);
        break;
      case "insight":
        tone(392, 0.16, effectiveVolume * 0.36, "sine", 0);
        tone(523, 0.18, effectiveVolume * 0.34, "sine", 0.12);
        tone(784, 0.28, effectiveVolume * 0.28, "sine", 0.24);
        noise(0.32, effectiveVolume * 0.18, 0.06, "highpass", 1500);
        break;
      case "skill_advance":
        tone(262, 0.16, effectiveVolume * 0.32, "triangle", 0);
        tone(392, 0.18, effectiveVolume * 0.34, "triangle", 0.14);
        tone(659, 0.32, effectiveVolume * 0.34, "sine", 0.3);
        noise(0.4, effectiveVolume * 0.22, 0.08, "bandpass", 900);
        break;
      case "elite_warning":
        tone(220, 0.11, effectiveVolume * 0.42, "square", 0);
        tone(220, 0.11, effectiveVolume * 0.42, "square", 0.2);
        tone(330, 0.12, effectiveVolume * 0.36, "triangle", 0.4);
        break;
      case "boss_intro":
        tone(98, 0.3, effectiveVolume * 0.55, "sawtooth", 0);
        tone(130, 0.36, effectiveVolume * 0.42, "triangle", 0.28);
        noise(0.45, effectiveVolume * 0.32, 0.06, "lowpass", 260);
        break;
      case "boss_warning":
        tone(164, 0.14, effectiveVolume * 0.54, "square", 0);
        tone(247, 0.16, effectiveVolume * 0.44, "square", 0.18);
        break;
      case "boss_hit":
        noise(0.08, effectiveVolume * 0.48, 0, "bandpass", 520);
        tone(210, 0.1, effectiveVolume * 0.28, "triangle", 0, 140);
        break;
      case "boss_defeated":
        tone(196, 0.2, effectiveVolume * 0.36, "triangle", 0);
        tone(294, 0.24, effectiveVolume * 0.38, "triangle", 0.18);
        tone(392, 0.42, effectiveVolume * 0.38, "sine", 0.38);
        noise(0.38, effectiveVolume * 0.18, 0.2, "bandpass", 720);
        break;
      case "scripture_reveal_rare":
        tone(523, 0.16, effectiveVolume * 0.34, "sine", 0);
        tone(784, 0.26, effectiveVolume * 0.34, "sine", 0.14);
        noise(0.24, effectiveVolume * 0.16, 0.06, "highpass", 1800);
        break;
      case "scripture_reveal_epic":
        tone(392, 0.16, effectiveVolume * 0.34, "triangle", 0);
        tone(587, 0.2, effectiveVolume * 0.36, "triangle", 0.16);
        tone(880, 0.36, effectiveVolume * 0.32, "sine", 0.34);
        noise(0.32, effectiveVolume * 0.2, 0.1, "bandpass", 1200);
        break;
      case "scripture_reveal_common":
      default:
        tone(440, 0.14, effectiveVolume * 0.36, "triangle", 0);
        tone(660, 0.16, effectiveVolume * 0.26, "sine", 0.1);
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
    case "heal_pickup":
    case "copper_gain":
      return 150;
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
