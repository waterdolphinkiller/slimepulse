import type { AgentEventPayload, HardwareMetrics, PetState, SessionRecord } from "./types.ts";

const VALID_STATES: ReadonlySet<string> = new Set<PetState>([
  "IDLE", "TYPING", "AI_THINKING", "AI_WORKING", "AI_JUGGLING",
  "NEED_APPROVAL", "TASK_DONE", "TASK_ERROR", "HIGH_LOAD",
  "PETTING", "DRAGGING", "SLEEPING",
]);

const STATE_PRIORITY: Record<PetState, number> = {
  DRAGGING: 100,
  NEED_APPROVAL: 90,
  TASK_ERROR: 85,
  TASK_DONE: 80,
  PETTING: 75,
  AI_JUGGLING: 70,
  AI_WORKING: 65,
  AI_THINKING: 60,
  HIGH_LOAD: 50,
  TYPING: 40,
  IDLE: 10,
  SLEEPING: 5,
};

export interface StateSnapshot {
  state: PetState;
  bubbleText: string | null;
  subagentCount: number;
  sessions: SessionRecord[];
  approvalSession: SessionRecord | null;
  digestingLabel: string | null;
  metrics: HardwareMetrics;
  lastPaw: "left" | "right";
  needsApproval: boolean;
  consecutiveErrors: number;
  empathyMode: boolean;
}

export class PetStateMachine {
  private currentState: PetState = "IDLE";
  private bubbleText: string | null = null;
  private bubbleExpiresAt = 0;
  private subagentCount = 0;
  private sessions = new Map<string, SessionRecord>();
  private digestingLabel: string | null = null;
  private digestExpiresAt = 0;
  private isDragging = false;
  private isPetting = false;
  private lastActivityAt = Date.now();
  private lastTypingAt = 0;
  private lastPaw: "left" | "right" = "left";
  private highLoadThreshold = 75;
  private sleepAfterMs = 60_000;
  private metrics: HardwareMetrics = { cpuPercent: 0, memoryPercent: 0, gpuPercent: null };
  private agentState: PetState | null = null;
  private agentExpiresAt = 0;
  private consecutiveErrors = 0;

  constructor(highLoadThreshold = 75, sleepAfterMs = 60_000) {
    this.highLoadThreshold = highLoadThreshold;
    this.sleepAfterMs = sleepAfterMs;
  }

  public setHighLoadThreshold(threshold: number): void {
    this.highLoadThreshold = Math.max(20, Math.min(99, threshold));
  }

  public normalizeState(raw: string): PetState {
    const upper = raw.trim().toUpperCase();
    if (VALID_STATES.has(upper)) return upper as PetState;
    const aliases: Record<string, PetState> = {
      THINKING: "AI_THINKING",
      WORKING: "AI_WORKING",
      CODING: "AI_WORKING",
      JUGGLING: "AI_JUGGLING",
      APPROVAL: "NEED_APPROVAL",
      PERMISSION: "NEED_APPROVAL",
      DONE: "TASK_DONE",
      SUCCESS: "TASK_DONE",
      ERROR: "TASK_ERROR",
      FAIL: "TASK_ERROR",
      BUSY: "HIGH_LOAD",
      PET: "PETTING",
      DRAG: "DRAGGING",
      SLEEP: "SLEEPING",
      NAP: "SLEEPING",
    };
    return aliases[upper] ?? "IDLE";
  }

  /** Starts the translucent "swallow & digest" file animation inside the slime belly. */
  public startDigesting(fileLabel: string, durationMs = 10_000, now = Date.now()): void {
    this.digestingLabel = fileLabel.slice(0, 22);
    this.digestExpiresAt = now + durationMs;
    this.lastActivityAt = now;
  }

  public finishDigesting(): void {
    this.digestingLabel = null;
    this.digestExpiresAt = 0;
  }

  public handleAgentEvent(event: AgentEventPayload, now = Date.now()): PetState {
    const next = this.normalizeState(event.state);
    this.lastActivityAt = now;
    if (next === "TASK_ERROR") this.consecutiveErrors += 1;
    else if (next === "TASK_DONE") this.consecutiveErrors = 0;

    if (typeof event.subagentDelta === "number") {
      this.subagentCount = Math.max(0, this.subagentCount + event.subagentDelta);
    }

    // P0 Multi-Session Isolation: track each terminal session independently!
    if (event.sessionId) {
      if (next === "IDLE") {
        this.sessions.delete(event.sessionId);
      } else {
        const ttl =
          next === "NEED_APPROVAL"
            ? Number.MAX_SAFE_INTEGER
            : event.durationMs ?? (next === "TASK_DONE" || next === "TASK_ERROR" ? 6000 : 45_000);
        this.sessions.set(event.sessionId, {
          id: event.sessionId,
          projectName: event.projectName || event.sessionId,
          state: next,
          label: event.label ?? null,
          updatedAt: now,
          expiresAt: ttl === Number.MAX_SAFE_INTEGER ? ttl : now + ttl,
        });
      }
    }

    if (next === "IDLE" && this.sessions.size === 0) {
      this.agentState = null;
      this.agentExpiresAt = 0;
      this.subagentCount = 0;
    } else if (next === "NEED_APPROVAL") {
      this.agentState = "NEED_APPROVAL";
      this.agentExpiresAt = Number.MAX_SAFE_INTEGER;
    } else if (next === "AI_JUGGLING" || this.subagentCount >= 2 || this.sessions.size >= 2) {
      this.agentState = "AI_JUGGLING";
      this.agentExpiresAt = event.durationMs ? now + event.durationMs : now + 45_000;
    } else {
      this.agentState = next;
      const ttl = event.durationMs ?? (next === "TASK_DONE" || next === "TASK_ERROR" ? 5000 : 15_000);
      this.agentExpiresAt = now + ttl;
    }

    if (event.label) {
      this.bubbleText = event.label;
      this.bubbleExpiresAt =
        next === "NEED_APPROVAL" ? Number.MAX_SAFE_INTEGER : now + (event.durationMs ?? 5500);
    }

    return this.tick(now).state;
  }

  public dismissApproval(now = Date.now()): SessionRecord | null {
    this.lastActivityAt = now;
    let approved: SessionRecord | null = null;
    for (const [id, rec] of this.sessions.entries()) {
      if (rec.state === "NEED_APPROVAL") {
        approved = rec;
        this.sessions.set(id, { ...rec, state: "AI_WORKING", expiresAt: now + 15_000 });
      }
    }
    if (this.agentState === "NEED_APPROVAL") {
      this.agentState = this.sessions.size >= 2 ? "AI_JUGGLING" : null;
      this.agentExpiresAt = this.sessions.size >= 2 ? now + 20_000 : 0;
      this.bubbleText = null;
      this.bubbleExpiresAt = 0;
    }
    this.tick(now);
    return approved;
  }

  public handlePawTap(paw: "left" | "right", now = Date.now()): void {
    this.lastPaw = paw;
    this.lastTypingAt = now;
    this.lastActivityAt = now;
    if (this.agentState === "SLEEPING") this.agentState = null;
  }

  public setDragging(dragging: boolean, now = Date.now()): void {
    this.isDragging = dragging;
    this.lastActivityAt = now;
    if (dragging && this.agentState === "SLEEPING") this.agentState = null;
    this.tick(now);
  }

  public setPetting(petting: boolean, now = Date.now()): void {
    this.isPetting = petting;
    if (petting) {
      this.lastActivityAt = now;
      if (this.agentState === "SLEEPING") this.agentState = null;
    }
    this.tick(now);
  }

  public updateHardware(metrics: HardwareMetrics, now = Date.now()): void {
    this.metrics = metrics;
    this.tick(now);
  }

  public showBubble(text: string, durationMs = 6000, now = Date.now()): void {
    this.bubbleText = text;
    this.bubbleExpiresAt = now + durationMs;
  }

  public tick(now = Date.now()): StateSnapshot {
    // Expire stale sessions
    for (const [id, rec] of this.sessions.entries()) {
      if (now >= rec.expiresAt) this.sessions.delete(id);
    }
    if (this.digestingLabel && now >= this.digestExpiresAt) {
      this.digestingLabel = null;
      this.digestExpiresAt = 0;
    }
    if (this.agentState && now >= this.agentExpiresAt) {
      this.agentState = null;
      this.agentExpiresAt = 0;
    }
    if (this.bubbleText && now >= this.bubbleExpiresAt) {
      this.bubbleText = null;
      this.bubbleExpiresAt = 0;
    }

    const activeSessions = Array.from(this.sessions.values());
    const approvalSession = activeSessions.find((s) => s.state === "NEED_APPROVAL") ?? null;

    const isSleepy = now - this.lastActivityAt >= this.sleepAfterMs;
    const candidates: PetState[] = [isSleepy ? "SLEEPING" : "IDLE"];

    if (this.isDragging) candidates.push("DRAGGING");
    if (this.isPetting) candidates.push("PETTING");
    if (approvalSession) candidates.push("NEED_APPROVAL");
    if (this.agentState) candidates.push(this.agentState);
    if (this.subagentCount >= 2 || activeSessions.length >= 2) candidates.push("AI_JUGGLING");

    const peakLoad = Math.max(this.metrics.cpuPercent, this.metrics.gpuPercent ?? 0);
    if (peakLoad >= this.highLoadThreshold) candidates.push("HIGH_LOAD");
    if (now - this.lastTypingAt < 450) candidates.push("TYPING");

    let best: PetState = isSleepy ? "SLEEPING" : "IDLE";
    let bestPrio = -1;
    for (const c of candidates) {
      const p = STATE_PRIORITY[c];
      if (p > bestPrio) {
        bestPrio = p;
        best = c;
      }
    }

    this.currentState = best;
    return {
      state: this.currentState,
      bubbleText: this.bubbleText,
      subagentCount: Math.max(this.subagentCount, activeSessions.length),
      sessions: activeSessions,
      approvalSession,
      digestingLabel: this.digestingLabel,
      metrics: this.metrics,
      lastPaw: this.lastPaw,
      needsApproval: this.currentState === "NEED_APPROVAL",
      consecutiveErrors: this.consecutiveErrors,
      empathyMode: this.consecutiveErrors >= 3,
    };
  }
}
