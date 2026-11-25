import type { PetState, SessionRecord, SlimeAccessory, SlimeDNA } from "./types.ts";
import { DEFAULT_DNA } from "./types.ts";
import type { StateSnapshot } from "./stateMachine.ts";
import type { BellyItem } from "./bellyShelf.ts";
import type { SoulSnapshot } from "./livingSoul.ts";

export interface SlimePalette {
  id: string;
  name: string;
  topTint: [number, number, number];
  midBody: [number, number, number];
  sssGlow: [number, number, number];
  rimStroke: [number, number, number];
  innerRim: [number, number, number];
  caustic: [number, number, number];
  eyeColor: string;
  blush: string;
}

export interface SlimeV2Overlay {
  fatnessScale: number;
  goldenOrbs: number;
  bellyItems: BellyItem[];
  languageTint: [number, number, number] | null;
  absorbedColor: [number, number, number] | null;
  meetingStealth: boolean;
  nightGlow: boolean;
  quotaSweating: boolean;
  bassLevel: number;
}

export const DEFAULT_V2_OVERLAY: SlimeV2Overlay = {
  fatnessScale: 1.0,
  goldenOrbs: 0,
  bellyItems: [],
  languageTint: null,
  absorbedColor: null,
  meetingStealth: false,
  nightGlow: false,
  quotaSweating: false,
  bassLevel: 0,
};

export interface BellyCapsuleRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SLIME_PALETTES: Record<string, SlimePalette> = {
  "classic-green": {
    id: "classic-green",
    name: "Optical Emerald Jelly (经典绿色史莱姆)",
    topTint: [187, 247, 208],
    midBody: [34, 197, 94],
    sssGlow: [190, 242, 100],
    rimStroke: [21, 128, 61],
    innerRim: [220, 252, 231],
    caustic: [74, 222, 128],
    eyeColor: "#064e3b",
    blush: "rgba(251, 113, 133, 0.48)",
  },
  "cyber-aqua": {
    id: "cyber-aqua",
    name: "Glacier Aqua Jelly (冰川透明果冻)",
    topTint: [207, 250, 254],
    midBody: [6, 182, 212],
    sssGlow: [125, 211, 252],
    rimStroke: [14, 116, 144],
    innerRim: [224, 242, 254],
    caustic: [34, 211, 238],
    eyeColor: "#083344",
    blush: "rgba(244, 114, 182, 0.48)",
  },
  "berry-pink": {
    id: "berry-pink",
    name: "Sakura Peach Jelly (草莓蜜桃果冻)",
    topTint: [252, 231, 243],
    midBody: [236, 72, 153],
    sssGlow: [253, 186, 116],
    rimStroke: [157, 23, 77],
    innerRim: [253, 242, 248],
    caustic: [244, 114, 182],
    eyeColor: "#500724",
    blush: "rgba(251, 146, 60, 0.50)",
  },
};

const OVERHEAT_PALETTE: SlimePalette = {
  id: "overheat",
  name: "Molten Jelly",
  topTint: [254, 240, 138],
  midBody: [239, 68, 68],
  sssGlow: [251, 191, 36],
  rimStroke: [153, 27, 27],
  innerRim: [254, 249, 195],
  caustic: [251, 146, 60],
  eyeColor: "#450a0a",
  blush: "rgba(239, 68, 68, 0.60)",
};

const NIGHT_GLOW_PALETTE: SlimePalette = {
  id: "night-glow",
  name: "Bioluminescent Jellyfish",
  topTint: [165, 243, 252],
  midBody: [20, 184, 166],
  sssGlow: [56, 189, 248],
  rimStroke: [15, 118, 110],
  innerRim: [207, 250, 254],
  caustic: [45, 212, 191],
  eyeColor: "#042f2e",
  blush: "rgba(129, 140, 248, 0.42)",
};

const rgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

function blendRgb(
  base: [number, number, number],
  tint: [number, number, number],
  weight: number
): [number, number, number] {
  return [
    Math.round(base[0] * (1 - weight) + tint[0] * weight),
    Math.round(base[1] * (1 - weight) + tint[1] * weight),
    Math.round(base[2] * (1 - weight) + tint[2] * weight),
  ];
}

interface InternalBubble {
  rx: number;
  ry: number;
  r: number;
  speed: number;
  phase: number;
  depth: number;
}

/**
 * SlimePulse v4.1.0 True Coupled Spring-Mass Ring & Juice Physics Engine:
 * - 32-node coupled spring-mass perimeter ring (real traveling surface waves when poked/tapped/gulped!)
 * - Strict volume conservation (sx * sy = 1) + 2nd-order fluid interior inertia lag
 * - Ink-drop chromatic dye diffusion wave on color absorption (`triggerDyeWave`)
 * - Dedicated Gulp / Spit / Burp mouth & wave animations (`triggerGulp`, `triggerSpit`, `triggerBurp`)
 */
export class SoftBodySlimeEngine {
  private readonly nodeCount = 32;
  private ringDisp: number[] = new Array(32).fill(0);
  private ringVel: number[] = new Array(32).fill(0);

  private blinkTimer = 2.6;
  private blinkAmount = 0;
  private squashPos = 0;
  private squashVel = 0;
  private shearPos = 0;
  private shearVel = 0;
  private faceLagX = 0;
  private faceLagY = 0;
  private interiorLagX = 0;
  private interiorLagY = 0;
  private pokeX = -999;
  private pokeY = -999;
  private pokeStrength = 0;
  private bubbles: InternalBubble[] = [];

  // Wall-Stick & Gravity Slide Physics
  private wallSide: "none" | "left" | "right" = "none";
  private wallSlideY = 90;
  private wallSlideVel = 0;
  private wallImpactSplat = 0;

  // Tear-Apart Split & Re-Merge Fluid Physics
  private splitActive = false;
  private splitX = 0;
  private splitVx = 0;
  private splitPhase: "separating" | "returning" = "separating";

  // Meeting Stealth Melt transition
  private stealthMelt = 0;

  // v4.1 Dedicated Feature Micro-Interactions
  private gulpTimer = 0;      // >0: wide "O" swallow mouth + radial gulp pulse
  private spitTimer = 0;      // >0: puffed cheeks + capsule eject burst
  private burpTimer = 0;      // >0: humorous burp wobble
  private dyeWaveProgress = 1; // 0..1 ink-drop color diffusion ring
  private dyeWaveColor: [number, number, number] | null = null;

  private lastCapsuleRects: BellyCapsuleRect[] = [];

  constructor() {
    for (let i = 0; i < 14; i++) {
      this.bubbles.push({
        rx: (Math.random() - 0.5) * 1.15,
        ry: Math.random(),
        r: 2.0 + Math.random() * 4.5,
        speed: 0.18 + Math.random() * 0.34,
        phase: Math.random() * Math.PI * 2,
        depth: 0.5 + Math.random() * 0.5,
      });
    }
  }

  /** Injects a localized radial impulse into the 32-node coupled spring-mass ring. */
  public impulseRing(centerIdx: number, strength: number, spread = 3): void {
    const N = this.nodeCount;
    for (let k = -spread; k <= spread; k++) {
      const idx = ((centerIdx + k) % N + N) % N;
      const falloff = Math.cos((k / (spread + 1)) * (Math.PI / 2));
      this.ringVel[idx] += strength * falloff;
    }
  }

  /** Advances the coupled 32-node spring-mass wave equation by dt seconds. */
  public stepSpringRing(dt: number): void {
    const N = this.nodeCount;
    const kRest = 145;
    const kNeighbor = 220;
    const damping = 7.2;
    const acc = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      const prev = this.ringDisp[(i - 1 + N) % N];
      const next = this.ringDisp[(i + 1) % N];
      const curr = this.ringDisp[i];
      acc[i] = -kRest * curr + kNeighbor * (prev + next - 2 * curr) - damping * this.ringVel[i];
    }
    for (let i = 0; i < N; i++) {
      this.ringVel[i] += acc[i] * dt;
      this.ringDisp[i] = Math.max(-22, Math.min(22, this.ringDisp[i] + this.ringVel[i] * dt));
    }
  }

  /** Exposed for automated physics verification tests. */
  public getRingEnergy(): number {
    let e = 0;
    for (let i = 0; i < this.nodeCount; i++) {
      e += Math.abs(this.ringDisp[i]) + Math.abs(this.ringVel[i]) * 0.05;
    }
    return Number(e.toFixed(4));
  }

  public triggerTap(paw: "left" | "right"): void {
    this.squashVel += 7.8;
    this.shearVel += (paw === "left" ? -1 : 1) * 5.2;
    this.impulseRing(paw === "left" ? 16 : 0, -68, 3);
  }

  public pokeAt(localX: number, localY: number, speed: number): void {
    this.pokeX = localX;
    this.pokeY = localY;
    this.pokeStrength = Math.min(1.0, this.pokeStrength + Math.min(0.45, speed * 0.018));
    if (speed > 8) {
      this.squashVel += Math.min(3.5, speed * 0.12);
      const angle = Math.atan2(localY - 200, localX - 140);
      const idx = Math.round(((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2)) * this.nodeCount) % this.nodeCount;
      this.impulseRing(idx, -Math.min(120, speed * 4.2), 2);
    }
  }

  public fling(vx: number, vy = -120): void {
    this.wallSide = vx < 0 ? "left" : "right";
    this.wallSlideY = Math.max(76, Math.min(130, 108 + vy * 0.12));
    this.wallSlideVel = 6;
    this.wallImpactSplat = 1.0;
    this.squashVel += 10.5;
    this.impulseRing(vx < 0 ? 16 : 0, -140, 4);
  }

  public triggerSplit(direction: -1 | 1 = 1): void {
    this.splitActive = true;
    this.splitX = direction * 24;
    this.splitVx = direction * 175;
    this.splitPhase = "separating";
    this.squashVel += 9.5;
    this.impulseRing(direction > 0 ? 0 : 16, 130, 3);
  }

  public triggerGulp(): void {
    this.gulpTimer = 0.48;
    this.squashVel -= 7.5;
    this.impulseRing(24, -110, 4); // Top mouth sucks inward!
  }

  public triggerSpit(): void {
    this.spitTimer = 0.42;
    this.squashVel += 9.0;
    this.impulseRing(24, 125, 3); // Top pops outward!
  }

  public triggerBurp(): void {
    this.burpTimer = 0.65;
    this.squashVel += 11.0;
    this.impulseRing(24, 140, 5);
  }

  public triggerDyeWave(rgb: [number, number, number]): void {
    this.dyeWaveColor = rgb;
    this.dyeWaveProgress = 0;
    this.squashVel += 5.5;
    this.impulseRing(8, 85, 5); // Bottom-up ripple
  }

  public isStuckToWall(): boolean {
    return this.wallSide !== "none";
  }

  public hitTestBellyCapsule(localX: number, localY: number): BellyCapsuleRect | null {
    for (const r of this.lastCapsuleRects) {
      if (localX >= r.x && localX <= r.x + r.w && localY >= r.y && localY <= r.y + r.h) {
        return r;
      }
    }
    return null;
  }

  private drawSmoothClosedBlob(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
    }
    ctx.closePath();
  }

  private drawAccessory(
    ctx: CanvasRenderingContext2D,
    accessory: SlimeAccessory,
    topX: number,
    topY: number,
    faceX: number,
    faceY: number,
    t: number,
    crownTilt = 0
  ): void {
    if (accessory === "none") return;
    ctx.save();
    if (accessory === "sprout") {
      const sway = Math.sin(t * 3.4) * 0.15 + this.interiorLagX * 0.025 + crownTilt;
      ctx.translate(topX, topY + 2);
      ctx.rotate(sway);
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2, -10, 0, -16);
      ctx.stroke();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.ellipse(-7, -17, 8, 4.5, -0.45, 0, Math.PI * 2);
      ctx.ellipse(7, -15, 7.5, 4, 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (accessory === "crown") {
      ctx.translate(topX, topY + 6);
      ctx.rotate(this.interiorLagX * 0.015 + crownTilt);
      // Soft contact shadow nested on the jelly dome
      ctx.fillStyle = "rgba(4, 24, 30, 0.34)";
      ctx.beginPath();
      ctx.ellipse(0, 5, 16, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 3D brushed metallic gold gradient + curved base band
      const gGold = ctx.createLinearGradient(-15, -10, 15, 6);
      gGold.addColorStop(0, "#b45309");
      gGold.addColorStop(0.28, "#facc15");
      gGold.addColorStop(0.48, "#fef3c7");
      gGold.addColorStop(0.74, "#eab308");
      gGold.addColorStop(1, "#92400e");
      ctx.fillStyle = gGold;
      ctx.beginPath();
      ctx.moveTo(-13, 3);
      ctx.lineTo(-15, -10);
      ctx.quadraticCurveTo(-8, -2, -5, -4);
      ctx.lineTo(0, -14);
      ctx.lineTo(5, -4);
      ctx.quadraticCurveTo(8, -2, 15, -10);
      ctx.lineTo(13, 3);
      ctx.quadraticCurveTo(0, 7.5, -13, 3);
      ctx.closePath();
      ctx.fill();
      // Pearl tips
      ctx.fillStyle = "#fef9c3";
      for (const [px, py] of [[-15, -10], [0, -14], [15, -10]]) {
        ctx.beginPath();
        ctx.arc(px, py, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 3D faceted ruby gem with specular highlight
      const gRuby = ctx.createRadialGradient(-1, -3, 0.5, 0, -2, 3.6);
      gRuby.addColorStop(0, "#fda4af");
      gRuby.addColorStop(0.45, "#e11d48");
      gRuby.addColorStop(1, "#881337");
      ctx.fillStyle = gRuby;
      ctx.beginPath();
      ctx.arc(0, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === "headphones") {
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(topX, faceY - 8, 52, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.fillStyle = "#38bdf8";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(topX + s * 48 - 7, faceY - 12, 14, 24, 6);
        ctx.fill();
        ctx.stroke();
      }
    } else if (accessory === "shades") {
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(faceX - 30, faceY - 8, 25, 14, 4);
      ctx.roundRect(faceX + 5, faceY - 8, 25, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(faceX - 5, faceY - 3);
      ctx.lineTo(faceX + 5, faceY - 3);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.moveTo(faceX - 24, faceY + 3);
      ctx.lineTo(faceX - 16, faceY - 5);
      ctx.moveTo(faceX + 11, faceY + 3);
      ctx.lineTo(faceX + 19, faceY - 5);
      ctx.stroke();
    } else if (accessory === "wizard") {
      ctx.translate(topX, topY);
      ctx.rotate(this.interiorLagX * 0.015 + crownTilt);
      ctx.fillStyle = "#4c1d95";
      ctx.strokeStyle = "#1e1b4b";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 3, 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 2);
      ctx.quadraticCurveTo(-4, -28, 12, -32);
      ctx.lineTo(18, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.font = "11px sans-serif";
      ctx.fillText("★", -4, -8);
    }
    ctx.restore();
  }

  private drawSessionMiniJelly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    session: SessionRecord | null,
    basePalette: SlimePalette,
    t: number,
    phase: number
  ): void {
    const isUrgent = session?.state === "NEED_APPROVAL" || session?.state === "TASK_ERROR";
    const p = isUrgent ? OVERHEAT_PALETTE : basePalette;
    const speed = isUrgent ? 11.0 : 7.0;
    const bounce = Math.abs(Math.sin(t * speed + phase));
    const sx = 1 + (1 - bounce) * 0.22 - bounce * 0.14;
    const sy = 1 / sx; // Strict volume conservation!
    const cy = y - bounce * (isUrgent ? 28 : 20);

    ctx.save();
    ctx.fillStyle = rgba(p.caustic, 0.45);
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.95, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, cy);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 1.12, -r * 1.18, r * 1.12, -r * 1.18, r, 0);
    ctx.quadraticCurveTo(0, r * 0.34, -r, 0);
    ctx.closePath();

    const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.6, r * 0.08, 0, -r * 0.25, r * 1.2);
    grad.addColorStop(0, rgba(p.topTint, 0.58));
    grad.addColorStop(0.55, rgba(p.midBody, 0.74));
    grad.addColorStop(1, rgba(p.sssGlow, 0.88));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = rgba(p.rimStroke, 0.88);
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, -r * 0.56, r * 0.24, r * 0.11, -0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.eyeColor;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.28, 2.2, 0, Math.PI * 2);
    ctx.arc(r * 0.28, -r * 0.28, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (session?.projectName) {
      const label = session.projectName.slice(0, 10);
      ctx.save();
      ctx.font = "bold 9px monospace";
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = isUrgent ? "rgba(220,38,38,0.92)" : "rgba(15,23,42,0.85)";
      ctx.beginPath();
      ctx.roundRect(x - tw / 2, y + 7, tw, 14, 5);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + 14);
      ctx.restore();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    snapshot: StateSnapshot,
    dna: SlimeDNA = DEFAULT_DNA,
    nowMs: number,
    dtMs: number,
    lookX: number,
    lookY: number,
    v2: SlimeV2Overlay = DEFAULT_V2_OVERLAY,
    soul?: SoulSnapshot,
    skipBody = false
  ): void {
    const t = nowMs / 1000;
    const dt = Math.min(0.033, dtMs / 1000);
    const st: PetState = snapshot.state;

    // Step coupled 32-node spring-mass wave physics!
    this.stepSpringRing(dt);

    // Step micro-interaction timers
    this.gulpTimer = Math.max(0, this.gulpTimer - dt);
    this.spitTimer = Math.max(0, this.spitTimer - dt);
    this.burpTimer = Math.max(0, this.burpTimer - dt);
    if (this.dyeWaveProgress < 1) {
      this.dyeWaveProgress = Math.min(1, this.dyeWaveProgress + dt * 2.8);
    }

    const meltTarget = v2.meetingStealth ? 1.0 : 0.0;
    this.stealthMelt += (meltTarget - this.stealthMelt) * Math.min(1, dt * 4.5);

    this.squashVel += (-190 * this.squashPos - 8.5 * this.squashVel) * dt;
    this.squashPos += this.squashVel * dt;
    this.shearVel += (-140 * this.shearPos - 7.5 * this.shearVel) * dt;
    this.shearPos += this.shearVel * dt;
    this.pokeStrength = Math.max(0, this.pokeStrength - dt * 3.8);

    if (this.splitActive) {
      if (this.splitPhase === "separating") {
        this.splitX += this.splitVx * dt;
        this.splitVx *= Math.pow(0.18, dt);
        if (Math.abs(this.splitVx) < 18 || Math.abs(this.splitX) > 90) {
          this.splitPhase = "returning";
        }
      } else {
        const dir = this.splitX > 0 ? -1 : 1;
        this.splitX += dir * 92 * dt;
        if (Math.abs(this.splitX) < 16) {
          this.splitActive = false;
          this.squashVel += 10.0;
          this.impulseRing(dir > 0 ? 16 : 0, 120, 4);
        }
      }
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = Math.min(1, this.blinkAmount + dt * 16);
      if (this.blinkTimer < -0.12) {
        this.blinkAmount = Math.max(0, this.blinkAmount - dt * 16);
        if (this.blinkAmount === 0) this.blinkTimer = 2.2 + Math.random() * 2.8;
      }
    }

    const rawPalette = v2.nightGlow
      ? NIGHT_GLOW_PALETTE
      : (SLIME_PALETTES[dna.flavor] ?? SLIME_PALETTES["classic-green"]);
    let p: SlimePalette =
      (st === "HIGH_LOAD" || (st === "TASK_ERROR" && !snapshot.empathyMode))
        ? OVERHEAT_PALETTE
        : rawPalette;

    if (v2.absorbedColor) {
      p = {
        ...rawPalette,
        midBody: v2.absorbedColor,
        caustic: v2.absorbedColor,
        sssGlow: blendRgb(v2.absorbedColor, [255, 255, 255], 0.35),
        topTint: blendRgb(v2.absorbedColor, [255, 255, 255], 0.65),
        rimStroke: blendRgb(v2.absorbedColor, [0, 0, 0], 0.35),
      };
    } else if (v2.languageTint && st !== "HIGH_LOAD" && st !== "TASK_ERROR") {
      p = {
        ...rawPalette,
        midBody: blendRgb(rawPalette.midBody, v2.languageTint, 0.28),
        caustic: blendRgb(rawPalette.caustic, v2.languageTint, 0.30),
        sssGlow: blendRgb(rawPalette.sssGlow, v2.languageTint, 0.20),
      };
    }

    const alphaScale = Math.max(0.42, Math.min(0.92, v2.nightGlow ? dna.translucency * 0.85 : dna.translucency));
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const groundY = H - 36;

    let cx = W / 2;
    let wallMode = false;
    if (this.wallSide !== "none" && this.stealthMelt < 0.2) {
      wallMode = true;
      this.wallImpactSplat = Math.max(0, this.wallImpactSplat - dt * 2.8);
      this.wallSlideVel = Math.min(46, this.wallSlideVel + 18 * dt);
      this.wallSlideY += this.wallSlideVel * dt;
      cx = this.wallSide === "left" ? 36 : W - 36;
      if (this.wallSlideY >= groundY - 34) {
        this.wallSide = "none";
        wallMode = false;
        this.squashVel += 11.5;
        this.impulseRing(8, -110, 5);
      }
    }

    // Strict Volume Conservation (sx * sy == 1) on spring squash/stretch!
    const volSx = Math.max(0.76, Math.min(1.28, 1 + this.squashPos * 0.22));
    const volSy = 1 / volSx;
    const fat = Math.max(1.0, Math.min(1.38, v2.fatnessScale || 1.0));
    const splitShrink = this.splitActive ? 0.88 : 1.0;

    let baseRx = 60 * fat * splitShrink * volSx;
    let baseRy = 48 * (1 + (fat - 1) * 0.72) * splitShrink * volSy;
    let liftY = 0;
    let wobbleAmp = 2.4 + (v2.bassLevel || 0) * 6.5;
    let wobbleFreq = 3.6 + (v2.bassLevel || 0) * 14.0;
    let spikeAmp = 0;
    let leanX = lookX * 7 + this.shearPos * 14;

    if (this.stealthMelt > 0.05) {
      baseRx = baseRx * (1 + this.stealthMelt * 0.55);
      baseRy = Math.max(9, baseRy * (1 - this.stealthMelt * 0.80));
      leanX *= 1 - this.stealthMelt;
    } else if (wallMode) {
      baseRx = (28 + this.wallImpactSplat * 8) * fat;
      baseRy = (66 + this.wallImpactSplat * 10) * (1 + (fat - 1) * 0.4);
      wobbleAmp = 3.0;
      leanX = 0;
    } else if (st === "IDLE") {
      const b = Math.sin(t * 2.9);
      baseRx += b * 4.0;
      baseRy -= b * 3.5;
    } else if (st === "TYPING") {
      const tap = Math.sin(t * 24);
      baseRx += 4 + tap * 3.8;
      baseRy -= 6 + tap * 3.4;
      wobbleAmp = 4.6;
    } else if (st === "AI_THINKING") {
      baseRx = 55 * fat * volSx;
      baseRy = (53 + Math.sin(t * 2.8) * 3.5) * volSy;
      leanX = Math.sin(t * 2.3) * 14;
    } else if (st === "AI_WORKING") {
      const jam = Math.sin(t * 22);
      baseRx += 2 + jam * 4.0;
      baseRy -= 3 + jam * 3.8;
      wobbleAmp = 4.2;
    } else if (st === "AI_JUGGLING") {
      const b = Math.abs(Math.sin(t * 7.2));
      baseRx = (53 * fat - b * 7 + (1 - b) * 9) * volSx;
      baseRy = (46 + b * 10 - (1 - b) * 7) * volSy;
      liftY = b * 18;
    } else if (st === "NEED_APPROVAL") {
      const hop = Math.abs(Math.sin(t * 9.0));
      baseRx = 56 * fat - hop * 11 + (1 - hop) * 13;
      baseRy = 48 + hop * 18 - (1 - hop) * 11;
      liftY = hop * 32;
    } else if (st === "TASK_DONE") {
      const jump = Math.abs(Math.sin(t * 7.5));
      baseRx = 56 * fat - jump * 12 + (1 - jump) * 14;
      baseRy = 48 + jump * 20 - (1 - jump) * 12;
      liftY = jump * 40;
    } else if (st === "TASK_ERROR") {
      if (snapshot.empathyMode) {
        baseRx = 64 * fat + Math.sin(t * 2.5) * 3;
        baseRy = 42 - Math.sin(t * 2.5) * 2;
      } else {
        baseRx = 56 * fat + Math.sin(t * 42) * 3;
        baseRy = 54 + Math.cos(t * 42) * 3;
        spikeAmp = 11.5;
        liftY = 8 + Math.abs(Math.sin(t * 16)) * 7;
      }
    } else if (st === "HIGH_LOAD") {
      const boil = Math.sin(t * 32);
      baseRx = 62 * fat + boil * 6.5;
      baseRy = 46 - boil * 6.5;
      wobbleAmp = 7.5;
      wobbleFreq = 18;
    } else if (st === "PETTING") {
      const purr = Math.sin(t * 5.0);
      baseRx = 74 * fat + purr * 5.5;
      baseRy = 33 - purr * 3.5;
    } else if (st === "DRAGGING") {
      baseRx = 38;
      baseRy = 68;
      liftY = 26;
      leanX = Math.sin(t * 8) * 11;
    } else if (st === "SLEEPING") {
      const b = Math.sin(t * 1.6);
      baseRx = 78 * fat + b * 4.5;
      baseRy = 25 - b * 2.5;
    }

    // 2nd-order fluid interior inertia lag (face, orbs, capsules & accessories sway with liquid delay!)
    const targetFaceX = wallMode ? (this.wallSide === "left" ? 6 : -6) : leanX * 0.55 + lookX * 6;
    const targetFaceY = wallMode ? 6 : (st === "SLEEPING" ? 4 : -2) + lookY * 3.5;
    this.faceLagX += (targetFaceX - this.faceLagX) * Math.min(1, dt * 11);
    this.faceLagY += (targetFaceY - this.faceLagY) * Math.min(1, dt * 11);
    this.interiorLagX += (this.faceLagX - this.interiorLagX) * Math.min(1, dt * 5.5);
    this.interiorLagY += (this.faceLagY - this.interiorLagY) * Math.min(1, dt * 5.5);

    if (!skipBody && !wallMode) {
      const shScale = Math.max(0.45, 1 - liftY / 88);
      ctx.fillStyle = "rgba(4, 10, 18, 0.46)";
      ctx.beginPath();
      ctx.ellipse(cx, groundY + 5, baseRx * 0.98 * shScale, 12 * shScale, 0, 0, Math.PI * 2);
      ctx.fill();
      const caustGrad = ctx.createRadialGradient(cx, groundY + 3, 2, cx, groundY + 3, baseRx * 0.82 * shScale);
      caustGrad.addColorStop(0, rgba(p.caustic, v2.nightGlow ? 0.65 : 0.52));
      caustGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = caustGrad;
      ctx.beginPath();
      ctx.ellipse(cx, groundY + 3, baseRx * 0.86 * shScale, 9 * shScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.splitActive && this.stealthMelt < 0.2) {
      const sx = cx + this.splitX;
      if (Math.abs(this.splitX) < 52) {
        ctx.save();
        ctx.strokeStyle = rgba(p.midBody, 0.68);
        ctx.lineWidth = Math.max(3, 18 - Math.abs(this.splitX) * 0.3);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, groundY - 22);
        ctx.quadraticCurveTo((cx + sx) / 2, groundY - 12, sx, groundY - 16);
        ctx.stroke();
        ctx.restore();
      }
      this.drawSessionMiniJelly(ctx, sx, groundY + 2, 18, null, p, t, 1.3);
    }

    if (!wallMode && this.stealthMelt < 0.2 && snapshot.sessions.length >= 2) {
      const sideSessions = snapshot.sessions.slice(0, 2);
      this.drawSessionMiniJelly(ctx, cx - 84, groundY + 2, 20, sideSessions[0], p, t, 0.0);
      this.drawSessionMiniJelly(ctx, cx + 84, groundY + 2, 20, sideSessions[1], p, t, 2.1);
    } else if (!wallMode && this.stealthMelt < 0.2 && st === "AI_JUGGLING") {
      this.drawSessionMiniJelly(ctx, cx - 84, groundY + 2, 20, null, p, t, 0.0);
      this.drawSessionMiniJelly(ctx, cx + 84, groundY + 2, 20, null, p, t, 2.1);
    }

    // 32-Node Coupled Spring-Mass Perimeter
    const N = this.nodeCount;
    const pts: Array<{ x: number; y: number }> = [];
    const bodyCy = wallMode ? this.wallSlideY : groundY - baseRy * 0.70 - liftY;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      let rx = sinA > 0.15 ? baseRx * (1.08 + sinA * 0.05) : baseRx * (1 - Math.abs(sinA) * 0.07);
      let ry = sinA > 0 ? baseRy * (st === "DRAGGING" || wallMode ? 0.85 : 0.52) : baseRy;
      if (wallMode && ((this.wallSide === "left" && cosA < 0) || (this.wallSide === "right" && cosA > 0))) {
        rx = baseRx * 0.42;
      }
      const wave =
        Math.sin(a * 3 + t * wobbleFreq) * wobbleAmp * (1 - Math.max(0, sinA) * 0.7) +
        Math.cos(a * 5 - t * wobbleFreq * 1.4) * (wobbleAmp * 0.35);
      const ringOffset = this.ringDisp[i] * (1 - Math.max(0, sinA) * 0.45);
      const spike = spikeAmp > 0 ? (i % 2 === 0 ? spikeAmp : -spikeAmp * 0.45) : 0;
      const topLean = sinA < 0 ? -sinA * leanX : 0;

      let px = cx + cosA * (rx + wave + ringOffset + spike) + topLean;
      let py = bodyCy + sinA * (ry + wave * 0.65 + ringOffset * 0.85 + spike);

      if (this.pokeStrength > 0.02) {
        const dx = px - this.pokeX;
        const dy = py - this.pokeY;
        const dist = Math.hypot(dx, dy);
        if (dist < 44) {
          const push = Math.exp(-(dist * dist) / 480) * 14 * this.pokeStrength;
          const toCenterX = (cx - px) / Math.max(1, Math.hypot(cx - px, bodyCy - py));
          const toCenterY = (bodyCy - py) / Math.max(1, Math.hypot(cx - px, bodyCy - py));
          px += toCenterX * push;
          py += toCenterY * push;
        }
      }
      pts.push({ x: px, y: py });
    }

    ctx.save();
    if (!skipBody) {
    ctx.shadowColor = rgba(p.caustic, v2.nightGlow ? 0.72 : 0.45);
    ctx.shadowBlur = v2.nightGlow ? 24 : 16;
    this.drawSmoothClosedBlob(ctx, pts);
    const bodyGrad = ctx.createRadialGradient(
      cx - baseRx * 0.18, bodyCy - baseRy * 0.42, baseRx * 0.08,
      cx, bodyCy + baseRy * 0.12, Math.max(baseRx, baseRy) * 1.2
    );
    bodyGrad.addColorStop(0.0, rgba(p.topTint, alphaScale * 0.74));
    bodyGrad.addColorStop(0.58, rgba(p.midBody, alphaScale));
    bodyGrad.addColorStop(1.0, rgba(p.rimStroke, Math.min(0.92, alphaScale + 0.16)));
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    if (!skipBody) ctx.clip();

    // Ink-drop chromatic diffusion wave (expands from bottom to top on color absorb!)
    if (this.dyeWaveProgress < 1 && this.dyeWaveColor) {
      const wr = this.dyeWaveProgress * Math.max(baseRx, baseRy) * 2.4;
      const wg = ctx.createRadialGradient(cx, bodyCy + baseRy * 0.6, Math.max(1, wr * 0.4), cx, bodyCy + baseRy * 0.6, Math.max(2, wr));
      wg.addColorStop(0, rgba(this.dyeWaveColor, 0.55 * (1 - this.dyeWaveProgress)));
      wg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, H);
    }

    const sss = ctx.createRadialGradient(cx, bodyCy + baseRy * 0.36, 4, cx, bodyCy + baseRy * 0.36, baseRx * 0.88);
    sss.addColorStop(0, rgba(p.sssGlow, 0.85));
    sss.addColorStop(0.65, rgba(p.sssGlow, 0.24));
    sss.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sss;
    ctx.fillRect(cx - baseRx * 1.5, bodyCy - baseRy * 1.5, baseRx * 3, baseRy * 3);

    } // end !skipBody outer fill/SSS
    // Floating golden `$` orbs with fluid interior inertia lag!
    const orbCount = Math.min(8, Math.max(0, v2.goldenOrbs || 0));
    for (let i = 0; i < orbCount; i++) {
      const ox = cx - this.interiorLagX * 0.55 + Math.sin(t * 1.3 + i * 1.7) * (baseRx * 0.46);
      const oy = bodyCy + 20 - this.interiorLagY * 0.35 + Math.cos(t * 1.7 + i * 2.1) * (baseRy * 0.16);
      ctx.save();
      // Submerged 3D refractive liquid-gold pearl (blends organically inside translucent jelly!)
      const glow = ctx.createRadialGradient(ox, oy, 2, ox, oy, 10);
      glow.addColorStop(0, "rgba(253, 224, 71, 0.40)");
      glow.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ox, oy, 10, 0, Math.PI * 2);
      ctx.fill();
      const pg = ctx.createRadialGradient(ox - 2.2, oy - 2.2, 0.8, ox, oy, 6.2);
      pg.addColorStop(0, "rgba(254, 249, 195, 0.92)");
      pg.addColorStop(0.45, "rgba(245, 158, 11, 0.78)");
      pg.addColorStop(1, "rgba(146, 64, 14, 0.42)");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(ox, oy, 6.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.arc(ox - 2.0, oy - 2.0, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (snapshot.empathyMode) {
      ctx.save();
      ctx.translate(cx + 18 - this.interiorLagX * 0.4, bodyCy - 12);
      ctx.rotate(-0.35);
      ctx.fillStyle = "rgba(254, 215, 170, 0.92)";
      ctx.strokeStyle = "rgba(194, 65, 12, 0.65)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-12, -5, 24, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }

    this.lastCapsuleRects = [];
    if (v2.bellyItems && v2.bellyItems.length > 0 && this.stealthMelt < 0.3) {
      v2.bellyItems.slice(0, 3).forEach((item, idx) => {
        const offset = (idx - (v2.bellyItems.length - 1) / 2) * 32;
        const bx = cx + offset - this.interiorLagX * 0.45 + Math.sin(t * 2.0 + idx) * 2.5;
        const by = bodyCy + 17 - this.interiorLagY * 0.3 + Math.cos(t * 2.4 + idx) * 2.5;
        const w = 28;
        const h = 16;
        this.lastCapsuleRects.push({ id: item.id, label: item.label, x: bx - w / 2, y: by - h / 2, w, h });
        ctx.save();
        ctx.translate(bx, by);
        ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
        ctx.strokeStyle = rgba(p.rimStroke, 0.85);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#064e3b";
        ctx.font = "bold 7.5px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label.slice(0, 5), 0, 0.5);
        ctx.restore();
      });
    } else if (snapshot.digestingLabel) {
      const fxDig = cx + Math.sin(t * 3.2) * 12;
      const fyDig = bodyCy + 12 + Math.cos(t * 4.5) * 5;
      ctx.save();
      ctx.translate(fxDig, fyDig);
      ctx.rotate(Math.sin(t * 2.5) * 0.25);
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      ctx.strokeStyle = rgba(p.rimStroke, 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-10, -12, 20, 24, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#15803d";
      ctx.fillRect(-6, -5, 12, 2);
      ctx.fillRect(-6, 0, 9, 2);
      ctx.fillRect(-6, 5, 10, 2);
      ctx.restore();
    }

    const activeBubbleCount = Math.max(3, Math.min(this.bubbles.length, dna.bubbleDensity));
    const bSpd = st === "HIGH_LOAD" || v2.quotaSweating ? 4.4 : st === "AI_WORKING" ? 2.4 : 1.0 + (v2.bassLevel || 0) * 2.5;
    for (let i = 0; i < activeBubbleCount; i++) {
      const b = this.bubbles[i];
      const prog = (b.ry + t * b.speed * bSpd) % 1.0;
      const bx = cx + b.rx * baseRx * 0.72 + Math.sin(t * 2.2 + b.phase) * 5 - this.interiorLagX * (0.35 * b.depth);
      const by = bodyCy + baseRy * 0.58 - prog * baseRy * 1.5;
      const br = b.r * (st === "HIGH_LOAD" ? 1.25 : 1.0);
      ctx.fillStyle = `rgba(255,255,255,${0.22 * b.depth})`;
      ctx.strokeStyle = `rgba(255,255,255,${0.52 * b.depth})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.arc(bx - br * 0.32, by - br * 0.32, Math.max(0.9, br * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    if (!skipBody) {
      this.drawSmoothClosedBlob(ctx, pts);
      ctx.strokeStyle = rgba(p.innerRim, v2.nightGlow ? 0.55 : 0.78);
      ctx.lineWidth = 5.5;
      ctx.stroke();
    }
    ctx.restore();
    if (!skipBody) {
      this.drawSmoothClosedBlob(ctx, pts);
      ctx.strokeStyle = rgba(p.rimStroke, 0.88);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    if (!skipBody && this.stealthMelt < 0.7) {
      ctx.save();
      ctx.translate(cx - baseRx * 0.34 + leanX * 0.45, bodyCy - baseRy * 0.48);
      ctx.rotate(-0.55);
      const specGrad = ctx.createLinearGradient(0, -10, 0, 10);
      specGrad.addColorStop(0, v2.nightGlow ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.95)");
      specGrad.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, baseRx * 0.26, baseRy * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.stealthMelt < 0.65) {
      ctx.save();
      ctx.globalAlpha = 1 - this.stealthMelt * 1.4;
      const fx = cx + (soul?.mood === "POUTING" ? soul.poutLookDir * 20 : this.faceLagX);
      const fy = bodyCy + this.faceLagY + (soul?.nodDrop ?? 0) * 14;
      const closed = st === "PETTING" || st === "SLEEPING" || this.blinkAmount > 0.65;
      const eyeSpread = wallMode ? 11.5 : 17.5;

      for (const side of [-1, 1]) {
        const ex = fx + side * eyeSpread;
        const ey = fy;
        if (soul?.mood === "DIZZY") {
          ctx.strokeStyle = p.eyeColor; ctx.lineWidth = 2.4; ctx.beginPath();
          for (let a = 0; a < Math.PI * 4; a += 0.4) { const rr = a * 0.65; const xx = ex + Math.cos(a + soul.dizzyAngle) * rr; const yy = ey + Math.sin(a + soul.dizzyAngle) * rr; if (a === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
          ctx.stroke();
        } else if (soul?.mood === "STARTLED") {
          ctx.fillStyle = "#fff"; ctx.strokeStyle = p.eyeColor; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = p.eyeColor; ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (closed || soul?.mood === "SWALLOW_CURSOR" || (soul?.nodDrop ?? 0) > 0.4) {
          ctx.strokeStyle = p.eyeColor;
          ctx.lineWidth = 3.0;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(ex, ey + (st === "PETTING" ? 2 : -1), 6, st === "PETTING" ? Math.PI * 1.1 : Math.PI * 0.1, st === "PETTING" ? Math.PI * 1.9 : Math.PI * 0.9);
          ctx.stroke();
        } else if (st === "TASK_ERROR" && !snapshot.empathyMode) {
          ctx.strokeStyle = p.eyeColor;
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ex - side * 5, ey - 5);
          ctx.lineTo(ex + side * 4, ey);
          ctx.lineTo(ex - side * 5, ey + 5);
          ctx.stroke();
        } else if (st === "TASK_DONE") {
          ctx.fillStyle = p.eyeColor;
          ctx.font = "bold 16px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("★", ex, ey);
        } else {
          ctx.fillStyle = p.eyeColor;
          ctx.beginPath();
          ctx.ellipse(ex, ey, 5.2, v2.nightGlow ? 5.8 : 7.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(ex - 1.7, ey - 2.5, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (v2.quotaSweating) {
        const swY = fy - 14 + ((t * 22) % 14);
        ctx.fillStyle = "rgba(186, 230, 253, 0.92)";
        ctx.beginPath();
        ctx.arc(fx + 28, swY, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }

      const cheekPuff = this.spitTimer > 0 ? 1.35 : 1.0;
      ctx.fillStyle = p.blush;
      ctx.beginPath();
      ctx.ellipse(fx - eyeSpread - 10, fy + 7, 7.2 * cheekPuff, 4.0 * cheekPuff, 0, 0, Math.PI * 2);
      ctx.ellipse(fx + eyeSpread + 10, fy + 7, 7.2 * cheekPuff, 4.0 * cheekPuff, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = p.eyeColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      if (this.gulpTimer > 0 || this.burpTimer > 0) {
        // Wide "O" gulp / burp mouth!
        ctx.fillStyle = "rgba(190, 18, 60, 0.88)";
        ctx.beginPath();
        ctx.ellipse(fx, fy + 10, 8.5, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (this.spitTimer > 0) {
        // Pursed "o" spit-launch mouth!
        ctx.fillStyle = "rgba(190, 18, 60, 0.88)";
        ctx.beginPath();
        ctx.arc(fx, fy + 10, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (st === "TASK_DONE" || st === "NEED_APPROVAL" || st === "AI_JUGGLING" || snapshot.digestingLabel) {
        ctx.fillStyle = "rgba(190, 18, 60, 0.85)";
        ctx.beginPath();
        ctx.arc(fx, fy + 7, 7.2, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (wallMode || st === "HIGH_LOAD" || (st === "TASK_ERROR" && !snapshot.empathyMode) || st === "DRAGGING") {
        ctx.fillStyle = "rgba(190, 18, 60, 0.85)";
        ctx.beginPath();
        ctx.ellipse(fx, fy + 11, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (st === "SLEEPING") {
        const br = 5 + Math.sin(t * 1.6) * 3.2;
        ctx.fillStyle = "rgba(224, 242, 254, 0.65)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(fx + 10, fy + 8, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(fx - 4, fy + 7, 4, 0.15, Math.PI - 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx + 4, fy + 7, 4, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }

      if ((soul?.bubbleRadius ?? 0) > 0.02) {
        const br = 4 + (soul?.bubbleRadius ?? 0) * 16;
        const bg2 = ctx.createRadialGradient(fx + 10 - br * 0.3, fy + 8 - br * 0.3, 1, fx + 10, fy + 8, br);
        bg2.addColorStop(0, "rgba(255,255,255,0.7)"); bg2.addColorStop(0.7, "rgba(186,230,253,0.22)"); bg2.addColorStop(1, "rgba(255,255,255,0.7)");
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(fx + 10, fy + 8, br, 0, Math.PI * 2); ctx.fill();
      }
      if (soul?.cursorTrapped) {
        ctx.save(); ctx.translate(cx + Math.sin(t * 14) * 5, bodyCy + 20); ctx.rotate(Math.sin(t * 12) * 0.3);
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 4); ctx.lineTo(2, 4); ctx.lineTo(4, 9); ctx.lineTo(1, 10); ctx.lineTo(-1, 4); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (!wallMode) {
        this.drawAccessory(ctx, dna.accessory, cx + leanX * 0.8, bodyCy - baseRy, fx, fy, t, soul?.crownTilt ?? 0);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
