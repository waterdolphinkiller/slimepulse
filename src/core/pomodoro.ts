/**
 * Anti-burnout Pomodoro tracker.
 * Watches continuous active typing sessions; if you code nonstop beyond
 * `limitMinutes` (default 45 min), the cat nudges you to hydrate & stretch.
 */
export class PomodoroGuard {
  private sessionStartAt: number | null = null;
  private lastActivityAt = 0;
  private reminded = false;
  private limitMs: number;
  private idleResetMs = 5 * 60 * 1000; // 5 min break resets session

  constructor(limitMinutes = 45) {
    this.limitMs = Math.max(5, limitMinutes) * 60 * 1000;
  }

  public setLimitMinutes(minutes: number): void {
    this.limitMs = Math.max(5, minutes) * 60 * 1000;
  }

  public recordActivity(now = Date.now()): void {
    if (this.sessionStartAt === null || now - this.lastActivityAt > this.idleResetMs) {
      this.sessionStartAt = now;
      this.reminded = false;
    }
    this.lastActivityAt = now;
  }

  public checkReminder(now = Date.now()): string | null {
    if (this.sessionStartAt === null) return null;
    if (now - this.lastActivityAt > this.idleResetMs) {
      this.sessionStartAt = null;
      this.reminded = false;
      return null;
    }
    if (!this.reminded && now - this.sessionStartAt >= this.limitMs) {
      this.reminded = true;
      const mins = Math.round(this.limitMs / 60000);
      return `${mins}m nonstop! Stretch & sip water~`;
    }
    return null;
  }

  public getActiveMinutes(now = Date.now()): number {
    if (this.sessionStartAt === null) return 0;
    return Math.floor((now - this.sessionStartAt) / 60000);
  }
}
