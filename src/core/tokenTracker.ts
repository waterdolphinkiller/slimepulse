export interface TokenUsageState {
  dateKey: string;
  todayTokens: number;
  todayCostUsd: number;
  sessionCostUsd: number;
  budgetAlertUsd: number;
  alertTriggered: boolean;
  byAgent: Record<string, number>;
  quotaPercent: number;
}

/**
 * Innovation 1 (v4.0): Token / API Cost Stomach + Per-Agent Breakdown + 5h Quota Heat
 * Tracks daily & per-session AI spend across Claude Code, Codex, OpenCode & MCP.
 */
export class TokenStomachTracker {
  private state: TokenUsageState;

  constructor(budgetAlertUsd = 2.0, initial?: Partial<TokenUsageState>) {
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = initial?.dateKey === today;
    this.state = {
      dateKey: today,
      todayTokens: sameDay ? (initial?.todayTokens ?? 0) : 0,
      todayCostUsd: sameDay ? (initial?.todayCostUsd ?? 0) : 0,
      sessionCostUsd: sameDay ? (initial?.sessionCostUsd ?? 0) : 0,
      budgetAlertUsd: initial?.budgetAlertUsd ?? budgetAlertUsd,
      alertTriggered: sameDay ? (initial?.alertTriggered ?? false) : false,
      byAgent: sameDay && initial?.byAgent ? { ...initial.byAgent } : {},
      quotaPercent: sameDay ? (initial?.quotaPercent ?? 0) : 0,
    };
  }

  public setBudgetAlertUsd(usd: number): void {
    this.state.budgetAlertUsd = Math.max(0.1, Number(usd) || 2.0);
  }

  public recordUsage(
    tokens: number,
    costUsd: number,
    agent = "claude-code"
  ): { burpAlert: string | null; fatness: number; quotaSweating: boolean } {
    const safeTokens = Math.max(0, Math.round(tokens));
    const safeCost = Math.max(0, costUsd);
    const key = agent.replace(/^log-watcher:/, "") || "agent";

    this.state.todayTokens += safeTokens;
    this.state.todayCostUsd = Number((this.state.todayCostUsd + safeCost).toFixed(4));
    this.state.sessionCostUsd = Number((this.state.sessionCostUsd + safeCost).toFixed(4));
    this.state.byAgent[key] = Number(((this.state.byAgent[key] ?? 0) + safeCost).toFixed(4));
    // Soft 5-hour quota heat proxy: $4.00 session spend ≈ 100% rate-limit heat
    this.state.quotaPercent = Math.min(100, Math.round((this.state.sessionCostUsd / 4.0) * 100));

    let burpAlert: string | null = null;
    if (!this.state.alertTriggered && this.state.sessionCostUsd >= this.state.budgetAlertUsd) {
      this.state.alertTriggered = true;
      burpAlert = `Burp! $${this.state.sessionCostUsd.toFixed(2)} burned in this loop!`;
    }

    return {
      burpAlert,
      fatness: this.getFatnessScale(),
      quotaSweating: this.state.quotaPercent >= 85,
    };
  }

  public resetSession(): void {
    this.state.sessionCostUsd = 0;
    this.state.alertTriggered = false;
    this.state.quotaPercent = 0;
  }

  public getFatnessScale(): number {
    const ratio = Math.min(1, this.state.todayCostUsd / 5.0);
    return Number((1.0 + ratio * 0.38).toFixed(3));
  }

  public getGoldenOrbCount(): number {
    if (this.state.todayCostUsd <= 0.01) return 0;
    return Math.min(8, Math.max(1, Math.ceil(this.state.todayCostUsd * 2.2)));
  }

  public formatAgentBreakdown(): string {
    const entries = Object.entries(this.state.byAgent);
    if (entries.length === 0) return `$${this.state.todayCostUsd.toFixed(2)}`;
    return entries.map(([k, v]) => `${k}:$${v.toFixed(2)}`).join(" · ");
  }

  public getSnapshot(): TokenUsageState {
    return { ...this.state, byAgent: { ...this.state.byAgent } };
  }
}
