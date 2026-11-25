export type SoulMood =
  | "NORMAL"
  | "SNEEZING"
  | "BLOWING_BUBBLE"
  | "STARTLED"
  | "DIZZY"
  | "POUTING"
  | "SWALLOW_CURSOR"
  | "NODDING_OFF"
  | "SOUR_FACE"
  | "CHEWING";

export interface SoulSnapshot {
  mood: SoulMood;
  crownTilt: number;      // radians: knocked askew by sneeze, then straightened
  bubbleRadius: number;   // 0..1 normalized size of blown bubble
  nodDrop: number;        // 0..1 sleepy head-nod droop
  poutLookDir: number;    // -1 or +1 face turns away while pouting
  dizzyAngle: number;     // spinning spiral-eye angle
  cursorTrapped: boolean; // playful cursor gulp active
  cursorSlimed: boolean;  // true for 12s after spitting cursor -> turns cursor into translucent jelly!
  bubbleText: string | null;
}

/**
 * SlimePulse v5.1.0 — "Living Soul" Autonomous Micro-Life & Emotional Memory Engine.
 * Gives the optical jelly genuine personality via natural gestures & idle life:
 * - Idle sneeze (knocks crown/sprout askew, then shakes head to straighten it)
 * - Idle bored bubble-blowing -> POP! startle reaction
 * - Late-night sleepy head-nodding ("小鸡啄米") -> sudden jolt awake
 * - Tease 5x across face -> playfully gulps your cursor for 1.5s
 * - Vigorous shake -> dizzy `@ _ @` spiral eyes -> 5s pout (petting forgives!)
 * - Emotional memory one-liners & file-type taste reactions (.log sour, .md nom-nom)
 */
export class SlimeLivingSoul {
  private mood: SoulMood = "NORMAL";
  private moodTimer = 0;
  private crownTilt = 0;
  private crownTiltVel = 0;
  private bubbleRadius = 0;
  private nodDrop = 0;
  private poutLookDir = 1;
  private dizzyAngle = 0;
  private idleCooldown = 14.0;
  private lastTeaseDir = 0;
  private teaseFlips = 0;
  private teaseWindowMs = 0;
  private shakeEnergy = 0;
  private pendingBubbleText: string | null = null;
  private slimedCursorTimer = 0;

  public triggerSneeze(): void {
    this.mood = "SNEEZING";
    this.moodTimer = 1.15;
    this.crownTilt = 0.54;
    this.crownTiltVel = 1.6;
    this.pendingBubbleText = "Achoo~! (Oops, my crown!)";
  }

  public triggerBlowBubble(): void {
    this.mood = "BLOWING_BUBBLE";
    this.moodTimer = 2.4;
    this.bubbleRadius = 0.05;
  }

  public triggerDizzy(): void {
    this.mood = "DIZZY";
    this.moodTimer = 2.2;
    this.pendingBubbleText = "@_@ Woah, stop spinning me!";
  }

  public triggerSwallowCursor(): void {
    this.mood = "SWALLOW_CURSOR";
    this.moodTimer = 1.6;
    this.teaseFlips = 0;
    this.pendingBubbleText = "Chomp! Caught your cursor~ ^◡^";
  }

  public triggerNodOff(): void {
    this.mood = "NODDING_OFF";
    this.moodTimer = 2.6;
    this.nodDrop = 0;
  }

  public forgivePout(): boolean {
    if (this.mood === "POUTING") {
      this.mood = "NORMAL";
      this.moodTimer = 0;
      this.pendingBubbleText = "Hmph... okay, forgiven ♥";
      return true;
    }
    return false;
  }

  /** Tracks organic left-right mouse teasing across the slime's face -> triggers Cursor Gulp or Dizzy! */
  public recordCursorSwipe(dx: number, speed: number, nowMs = Date.now()): SoulMood | null {
    if (this.mood === "DIZZY" || this.mood === "SWALLOW_CURSOR") return null;

    // Detect rapid back-and-forth teasing
    if (Math.abs(dx) > 6) {
      const dir = dx > 0 ? 1 : -1;
      if (nowMs - this.teaseWindowMs > 1800) {
        this.teaseFlips = 0;
      }
      if (dir !== this.lastTeaseDir) {
        this.lastTeaseDir = dir;
        this.teaseFlips += 1;
        this.teaseWindowMs = nowMs;
      }
    }

    // Detect vigorous shaking
    if (speed > 34) {
      this.shakeEnergy += speed * 0.032;
      if (this.shakeEnergy >= 7.5) {
        this.shakeEnergy = 0;
        this.triggerDizzy();
        return "DIZZY";
      }
    }

    if (this.teaseFlips >= 5) {
      this.triggerSwallowCursor();
      return "SWALLOW_CURSOR";
    }
    return null;
  }

  /** File-type taste reaction: .log tastes sour, .md tastes crunchy, images absorb pigment! */
  public reactToFile(filename: string): string | null {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".log") || lower.includes("error")) {
      this.mood = "SOUR_FACE";
      this.moodTimer = 1.8;
      return ">_< Sour error log! Let's fix it~";
    }
    if (lower.endsWith(".md") || lower.endsWith(".txt")) {
      this.mood = "CHEWING";
      this.moodTimer = 1.6;
      return "Nom nom~ Tasty notes!";
    }
    return null;
  }

  /** Emotional memory one-liner when a build finally turns green after consecutive errors or late at night. */
  public reactToBuildSuccess(priorErrors: number, now = new Date()): string | null {
    if (priorErrors >= 3) {
      return "FINALLY GREEN!! I was sweating for you ♥";
    }
    const day = now.getDay();
    const hr = now.getHours();
    if (day === 5 && hr >= 18) {
      return "Friday night ship? Brave soul! 🚀";
    }
    if (hr >= 0 && hr < 5) {
      return "Late-night green build! Don't forget to rest~";
    }
    return null;
  }

  public tick(dt: number, isIdle: boolean, isLateNight: boolean): SoulSnapshot {
    this.shakeEnergy = Math.max(0, this.shakeEnergy - dt * 2.8);
    this.slimedCursorTimer = Math.max(0, this.slimedCursorTimer - dt);
    this.dizzyAngle += dt * 9.5;

    // Spring-damper to smoothly straighten crown after sneeze
    const targetTilt = this.mood === "SNEEZING" && this.moodTimer > 0.45 ? 0.48 : 0;
    this.crownTiltVel += ((targetTilt - this.crownTilt) * 65 - this.crownTiltVel * 6.5) * dt;
    this.crownTilt += this.crownTiltVel * dt;

    let outText = this.pendingBubbleText;
    this.pendingBubbleText = null;

    if (this.mood !== "NORMAL") {
      this.moodTimer -= dt;
      if (this.mood === "BLOWING_BUBBLE") {
        this.bubbleRadius = Math.min(1.0, this.bubbleRadius + dt * 0.46);
        if (this.moodTimer <= 0) {
          this.mood = "STARTLED";
          this.moodTimer = 0.55;
          this.bubbleRadius = 0;
          outText = "POP! Eek!!";
        }
      } else if (this.mood === "DIZZY" && this.moodTimer <= 0) {
        this.mood = "POUTING";
        this.moodTimer = 5.0;
        this.poutLookDir = Math.random() > 0.5 ? 1 : -1;
        outText = "Hmph! Not talking to you for 5s...";
      } else if (this.mood === "NODDING_OFF") {
        this.nodDrop = this.moodTimer > 0.45 ? Math.min(1, this.nodDrop + dt * 0.65) : 0;
        if (this.moodTimer <= 0) {
          this.mood = "NORMAL";
          outText = "I'm awake! Still coding with you~";
        }
      } else if (this.mood === "SWALLOW_CURSOR" && this.moodTimer <= 0) {
        this.mood = "NORMAL";
        this.slimedCursorTimer = 12.0;
        outText = "Ptoo! Coated your cursor in translucent jelly~";
      } else if (this.moodTimer <= 0) {
        this.mood = "NORMAL";
        this.bubbleRadius = 0;
        this.nodDrop = 0;
      }
    } else if (isIdle) {
      this.idleCooldown -= dt;
      if (this.idleCooldown <= 0) {
        this.idleCooldown = 18 + Math.random() * 14;
        if (isLateNight && Math.random() < 0.5) {
          this.triggerNodOff();
        } else if (Math.random() < 0.5) {
          this.triggerSneeze();
        } else {
          this.triggerBlowBubble();
        }
      }
    }

    return {
      mood: this.mood,
      crownTilt: Number(this.crownTilt.toFixed(4)),
      bubbleRadius: Number(this.bubbleRadius.toFixed(3)),
      nodDrop: Number(this.nodDrop.toFixed(3)),
      poutLookDir: this.poutLookDir,
      dizzyAngle: this.dizzyAngle,
      cursorTrapped: this.mood === "SWALLOW_CURSOR",
      cursorSlimed: this.slimedCursorTimer > 0,
      bubbleText: outText,
    };
  }
}

/**
 * Generates a glossy, translucent slime-shaped SVG mouse cursor tinted to the slime's exact RGB!
 * Applied via `element.style.cursor = buildSlimeCursorCss([r, g, b])` after spitting out the cursor.
 */
export function buildSlimeCursorCss(rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  const hiR = Math.min(255, r + 95);
  const hiG = Math.min(255, g + 95);
  const hiB = Math.min(255, b + 95);
  const dkR = Math.max(0, Math.round(r * 0.55));
  const dkG = Math.max(0, Math.round(g * 0.55));
  const dkB = Math.max(0, Math.round(b * 0.55));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<defs><radialGradient id="g" cx="35%" cy="28%" r="70%">` +
    `<stop offset="0%" stop-color="rgba(${hiR},${hiG},${hiB},0.72)"/>` +
    `<stop offset="55%" stop-color="rgba(${r},${g},${b},0.78)"/>` +
    `<stop offset="100%" stop-color="rgba(${dkR},${dkG},${dkB},0.88)"/>` +
    `</radialGradient></defs>` +
    `<path d="M4 3 C4 3 19 8 24 14 C27 18 23 23 18 22 C15 21.5 14 25 11 27 C8 29 5 26 5 22 C5 17 4 3 4 3 Z" fill="url(#g)" stroke="rgba(${hiR},${hiG},${hiB},0.92)" stroke-width="1.6"/>` +
    `<ellipse cx="10.5" cy="10.5" rx="3.2" ry="1.6" transform="rotate(-35 10.5 10.5)" fill="rgba(255,255,255,0.85)"/>` +
    `<circle cx="11.5" cy="15.5" r="1.4" fill="rgba(${dkR},${dkG},${dkB},0.95)"/>` +
    `<circle cx="16.2" cy="16.2" r="1.4" fill="rgba(${dkR},${dkG},${dkB},0.95)"/>` +
    `<circle cx="24" cy="26" r="2.2" fill="rgba(${r},${g},${b},0.68)"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 3, auto`;
}
