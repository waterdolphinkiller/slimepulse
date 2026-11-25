import type { LocaleSetting } from "./i18n.ts";

export type PetState =
  | "IDLE"
  | "TYPING"
  | "AI_THINKING"
  | "AI_WORKING"
  | "AI_JUGGLING"
  | "NEED_APPROVAL"
  | "TASK_DONE"
  | "TASK_ERROR"
  | "HIGH_LOAD"
  | "PETTING"
  | "DRAGGING"
  | "SLEEPING";

export type SlimeFlavor = "classic-green" | "cyber-aqua" | "berry-pink";
export type SlimeAccessory = "none" | "sprout" | "crown" | "headphones" | "shades" | "wizard";

/** Shareable 20-line JSON "Slime DNA" preset for community sharing on GitHub / X */
export interface SlimeDNA {
  version: 1;
  flavor: SlimeFlavor;
  accessory: SlimeAccessory;
  translucency: number; // 0.45..0.90
  bubbleDensity: number; // 3..14
}

export interface SessionRecord {
  id: string;
  projectName: string;
  state: PetState;
  label: string | null;
  updatedAt: number;
  expiresAt: number;
}

export interface AgentEventPayload {
  state: PetState | string;
  label?: string;
  source?: string;
  sessionId?: string;
  projectName?: string;
  toolName?: string;
  filePath?: string;
  tokensUsed?: number;
  costUsd?: number;
  subagentDelta?: number;
  durationMs?: number;
}

export interface HardwareMetrics {
  cpuPercent: number;
  memoryPercent: number;
  gpuPercent: number | null;
  meetingStealth?: boolean;
}

export interface PawTapEvent {
  paw: "left" | "right";
}

export interface LocalCursorPos {
  x: number;
  y: number;
  insideWindow: boolean;
}

export interface AppConfig {
  dna: SlimeDNA;
  locale: LocaleSetting;
  petScale: number; // 0.75 | 1.0 | 1.25
  lockPosition: boolean;
  ecoMode: boolean; // 24 FPS battery-saver mode
  highLoadThreshold: number;
  budgetAlertUsd: number;
  autoMeetingStealth: boolean;
  autoNightGlow: boolean;
  enableTypingRipples: boolean;
  enableSoundEffects: boolean;
  ambientSound: "off" | "purr" | "rain";
  pomodoroMinutes: number;
  aiProvider: "ollama" | "openai" | "anthropic";
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
  webhookPort: number;
}

export const DEFAULT_DNA: SlimeDNA = {
  version: 1,
  flavor: "classic-green",
  accessory: "sprout",
  translucency: 0.72,
  bubbleDensity: 9,
};

export const DEFAULT_CONFIG: AppConfig = {
  dna: { ...DEFAULT_DNA },
  locale: "auto",
  petScale: 1.0,
  lockPosition: false,
  ecoMode: false,
  highLoadThreshold: 75,
  budgetAlertUsd: 2.0,
  autoMeetingStealth: true,
  autoNightGlow: true,
  enableTypingRipples: true,
  enableSoundEffects: true,
  ambientSound: "off",
  pomodoroMinutes: 45,
  aiProvider: "ollama",
  aiEndpoint: "http://127.0.0.1:11434/api/chat",
  aiModel: "llama3.2",
  aiApiKey: "",
  webhookPort: 47890,
};
