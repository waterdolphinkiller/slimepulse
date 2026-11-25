import type { SlimeAccessory } from "./types.ts";

export type CodeLanguage = "none" | "rust" | "python" | "typescript" | "go";

export interface EvolutionState {
  xp: number;
  level: number;
  commits: number;
  activeLanguage: CodeLanguage;
  unlockedAccessories: SlimeAccessory[];
}

export const LANGUAGE_TINTS: Record<CodeLanguage, [number, number, number] | null> = {
  none: null,
  rust: [249, 115, 22],       // Molten Rust orange
  python: [59, 130, 246],     // Python cobalt blue
  typescript: [14, 165, 233], // TypeScript ocean cyan
  go: [6, 182, 212],          // Go sky cyan
};

const LEVEL_UNLOCKS: Array<{ level: number; xpRequired: number; accessory: SlimeAccessory }> = [
  { level: 1, xpRequired: 0, accessory: "sprout" },
  { level: 2, xpRequired: 50, accessory: "shades" },
  { level: 3, xpRequired: 150, accessory: "headphones" },
  { level: 4, xpRequired: 300, accessory: "wizard" },
  { level: 5, xpRequired: 500, accessory: "crown" },
];

/**
 * Innovation 3: Code Language Absorption & Commit XP Evolution
 * Detects the active programming language from file paths (tinted chromatic absorption)
 * and levels up the slime with local XP on completed tasks & commits to unlock accessories.
 */
export class SlimeEvolutionEngine {
  private state: EvolutionState;

  constructor(initial?: Partial<EvolutionState>) {
    this.state = {
      xp: initial?.xp ?? 0,
      level: initial?.level ?? 1,
      commits: initial?.commits ?? 0,
      activeLanguage: initial?.activeLanguage ?? "none",
      unlockedAccessories: initial?.unlockedAccessories ?? ["none", "sprout"],
    };
    this.recomputeLevel();
  }

  public detectLanguageFromPath(filePath?: string | null): CodeLanguage {
    if (!filePath) return this.state.activeLanguage;
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".rs") || lower.includes("cargo.toml")) this.state.activeLanguage = "rust";
    else if (lower.endsWith(".py")) this.state.activeLanguage = "python";
    else if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js")) this.state.activeLanguage = "typescript";
    else if (lower.endsWith(".go")) this.state.activeLanguage = "go";
    return this.state.activeLanguage;
  }

  public awardXp(points: number, isCommit = false): { leveledUp: boolean; newLevel: number; unlocked: SlimeAccessory | null } {
    const prevLevel = this.state.level;
    this.state.xp += Math.max(0, Math.round(points));
    if (isCommit) this.state.commits += 1;

    const unlocked = this.recomputeLevel();
    return {
      leveledUp: this.state.level > prevLevel,
      newLevel: this.state.level,
      unlocked,
    };
  }

  private recomputeLevel(): SlimeAccessory | null {
    let newlyUnlocked: SlimeAccessory | null = null;
    for (const tier of LEVEL_UNLOCKS) {
      if (this.state.xp >= tier.xpRequired) {
        if (tier.level > this.state.level) this.state.level = tier.level;
        if (!this.state.unlockedAccessories.includes(tier.accessory)) {
          this.state.unlockedAccessories.push(tier.accessory);
          newlyUnlocked = tier.accessory;
        }
      }
    }
    return newlyUnlocked;
  }

  public getSnapshot(): EvolutionState {
    return { ...this.state, unlockedAccessories: [...this.state.unlockedAccessories] };
  }
}
