import type { EventHistoryEntry, GameEventName } from "../types";

type Listener<T = unknown> = (payload: T) => void;

export class EventBus {
  private readonly listeners = new Map<GameEventName, Set<Listener>>();
  private readonly history: EventHistoryEntry[] = [];
  private historyLimit = 200;
  private sequence = 0;

  on<T = unknown>(eventName: GameEventName, listener: Listener<T>): () => void {
    const listenersForEvent = this.listeners.get(eventName) ?? new Set<Listener>();
    listenersForEvent.add(listener as Listener);
    this.listeners.set(eventName, listenersForEvent);

    return () => {
      listenersForEvent.delete(listener as Listener);
    };
  }

  emit<T = unknown>(eventName: GameEventName, payload: T): void {
    this.record(eventName, payload);
    const listenersForEvent = this.listeners.get(eventName);
    if (!listenersForEvent) {
      return;
    }

    for (const listener of listenersForEvent) {
      listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
    this.clearHistory();
  }

  setHistoryLimit(limit: number): void {
    if (!Number.isFinite(limit)) {
      return;
    }

    this.historyLimit = Math.max(1, Math.floor(limit));
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  getHistory(): EventHistoryEntry[] {
    return this.history.map((entry) => ({
      ...entry,
      payload: sanitizePayload(entry.payload)
    }));
  }

  getLastEvent(): EventHistoryEntry | undefined {
    const entry = this.history.at(-1);
    return entry
      ? {
        ...entry,
        payload: sanitizePayload(entry.payload)
      }
      : undefined;
  }

  getHistorySummary(): { count: number; lastEventName: GameEventName | "none" } {
    return {
      count: this.history.length,
      lastEventName: this.history.at(-1)?.name ?? "none"
    };
  }

  clearHistory(): void {
    this.history.length = 0;
    this.sequence = 0;
  }

  private record(eventName: GameEventName, payload: unknown): void {
    this.history.push({
      sequence: ++this.sequence,
      name: eventName,
      payload: sanitizePayload(payload),
      timestampMs: Math.round(performance.now())
    });

    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }
}

function sanitizePayload(payload: unknown): unknown {
  if (payload === undefined || payload === null || typeof payload !== "object") {
    return payload;
  }

  try {
    return JSON.parse(JSON.stringify(payload)) as unknown;
  } catch {
    return { unserializable: true };
  }
}

export const eventBus = new EventBus();
