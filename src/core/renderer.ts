import type { PetState, SlimeDNA } from "./types.ts";
import { DEFAULT_DNA } from "./types.ts";
import type { StateSnapshot } from "./stateMachine.ts";
import { WebGLSlimeShader } from "./webglSlimeEngine.ts";
import type { SoulSnapshot } from "./livingSoul.ts";
import {
  DEFAULT_V2_OVERLAY,
  SoftBodySlimeEngine,
  type BellyCapsuleRect,
  type SlimeV2Overlay,
} from "./slimeEngine.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: "star" | "code" | "heart" | "steam" | "alert" | "zzz" | "droplet" | "gold";
  glyph?: string;
  color: string;
}

export class SlimeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private slime: SoftBodySlimeEngine;
  private glShader: WebGLSlimeShader | null = null;
  private soulSnap: SoulSnapshot | undefined = undefined;
  private dna: SlimeDNA = { ...DEFAULT_DNA };
  private v2Overlay: SlimeV2Overlay = { ...DEFAULT_V2_OVERLAY };
  private particles: Particle[] = [];
  private lastState: PetState = "IDLE";
  private particleCooldown = 0;
  private lookX = 0;
  private lookY = 0;
  private lastMouseX = -999;
  private lastMouseY = -999;
  public enableTypingRipples = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.slime = new SoftBodySlimeEngine();
    const glCanvas = typeof document !== "undefined" ? (document.getElementById("gl-canvas") as HTMLCanvasElement | null) : null;
    if (glCanvas) this.glShader = WebGLSlimeShader.create(glCanvas);
  }

  public setDNA(dna: SlimeDNA): void {
    this.dna = { ...dna };
  }

  public setSoulSnapshot(snap: SoulSnapshot): void { this.soulSnap = snap; }

  public setV2Overlay(overlay: Partial<SlimeV2Overlay>): void {
    this.v2Overlay = { ...this.v2Overlay, ...overlay };
  }

  public flingToWall(vx: number, vy = -120): void {
    this.slime.fling(vx, vy);
    this.spawnBurst("droplet", 5);
  }

  public triggerSplit(dir: -1 | 1 = 1): void {
    this.slime.triggerSplit(dir);
    this.spawnBurst("droplet", 4);
  }

  public triggerGulp(): void {
    this.slime.triggerGulp();
    this.spawnBurst("droplet", 3);
  }

  public triggerSpit(): void {
    this.slime.triggerSpit();
    this.spawnBurst("star", 4);
  }

  public triggerBurp(): void {
    this.slime.triggerBurp();
    this.spawnBurst("gold", 7);
  }

  public triggerDyeWave(rgb: [number, number, number]): void {
    this.slime.triggerDyeWave(rgb);
    this.spawnBurst("droplet", 5);
  }

  public hitTestBellyCapsule(localX: number, localY: number): BellyCapsuleRect | null {
    return this.slime.hitTestBellyCapsule(localX, localY);
  }

  public setCursorLook(localX: number, localY: number): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height * 0.56;
    this.lookX = Math.max(-1, Math.min(1, (localX - cx) / 90));
    this.lookY = Math.max(-1, Math.min(1, (localY - cy) / 90));

    if (this.lastMouseX > -500) {
      const speed = Math.hypot(localX - this.lastMouseX, localY - this.lastMouseY);
      if (this.isPointOnSlime(localX, localY)) {
        this.slime.pokeAt(localX, localY, speed);
      }
    }
    this.lastMouseX = localX;
    this.lastMouseY = localY;
  }

  public isPointOnSlime(localX: number, localY: number): boolean {
    if (this.slime.isStuckToWall()) return true;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height - 76;
    const dx = (localX - cx) / 86;
    const dy = (localY - cy) / 72;
    return dx * dx + dy * dy <= 1.0;
  }

  public spawnTypingRipple(paw: "left" | "right"): void {
    this.slime.triggerTap(paw);
    if (!this.enableTypingRipples) return;
    const px = this.canvas.width / 2 + (paw === "left" ? -24 : 24);
    const py = this.canvas.height - 62;
    this.particles.push({
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -1.8 - Math.random() * 1.0,
      life: 0,
      maxLife: 460,
      kind: "droplet",
      color: "#86efac",
    });
  }

  public spawnBurst(kind: Particle["kind"], count = 5): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height * 0.35;
    const codeGlyphs = ["{ }", "fn", "=>", "</>"];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 68,
        y: cy + (Math.random() - 0.5) * 18,
        vx: kind === "zzz" ? 0.38 : (Math.random() - 0.5) * 1.9,
        vy: kind === "zzz" ? -0.52 : -1.0 - Math.random() * 1.4,
        life: 0,
        maxLife: kind === "zzz" ? 1500 : 850 + Math.random() * 450,
        kind,
        glyph: kind === "code" ? codeGlyphs[i % codeGlyphs.length] : kind === "zzz" ? "Z" : kind === "gold" ? "$" : undefined,
        color:
          kind === "heart"
            ? "#fb7185"
            : kind === "star" || kind === "gold"
            ? "#fde047"
            : kind === "steam"
            ? "#fb923c"
            : kind === "alert"
            ? "#ef4444"
            : "#bbf7d0",
      });
    }
  }

  public render(snapshot: StateSnapshot, now: number, dtMs: number): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (snapshot.state !== this.lastState) {
      this.lastState = snapshot.state;
      if (snapshot.state === "TASK_DONE") this.spawnBurst("star", 8);
      if (snapshot.state === "TASK_ERROR" && !snapshot.empathyMode) this.spawnBurst("steam", 7);
      if (snapshot.state === "PETTING") this.spawnBurst("heart", 5);
      if (snapshot.state === "NEED_APPROVAL") this.spawnBurst("alert", 3);
    }

    this.particleCooldown -= dtMs;
    if (this.particleCooldown <= 0) {
      if (snapshot.state === "AI_WORKING") {
        this.spawnBurst("code", 1);
        this.particleCooldown = 340;
      } else if (snapshot.state === "HIGH_LOAD") {
        this.spawnBurst("steam", 2);
        this.particleCooldown = 200;
      } else if (snapshot.state === "PETTING") {
        this.spawnBurst("heart", 1);
        this.particleCooldown = 480;
      } else if (snapshot.state === "SLEEPING") {
        this.spawnBurst("zzz", 1);
        this.particleCooldown = 1000;
      }
    }

    if (this.glShader) {
      this.glShader.render({
        nowMs: now,
        dna: this.dna,
        overlay: this.v2Overlay,
        squash: Math.sin(now / 360) * 0.06,
        splitXNorm: 0,
        pokeXNorm: this.lookX,
        pokeYNorm: -this.lookY,
        pokeStrength: 0,
        melt: this.v2Overlay.meetingStealth ? 1 : 0,
        wallSide: this.slime.isStuckToWall() ? 1 : 0,
        wallYNorm: 0,
        showGrid: false,
      });
    }
    this.slime.render(this.ctx, snapshot, this.dna, now, dtMs, this.lookX, this.lookY, this.v2Overlay, this.soulSnap, Boolean(this.glShader));

    this.particles = this.particles.filter((p) => {
      p.life += dtMs;
      if (p.life >= p.maxLife) return false;
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "droplet") p.vy += 0.08;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      if (p.kind === "droplet") {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.kind === "code" || p.kind === "gold") {
        this.ctx.font = "bold 13px monospace";
        this.ctx.fillText(p.glyph ?? "$", p.x, p.y);
      } else if (p.kind === "zzz") {
        this.ctx.font = `bold ${11 + Math.round((p.life / p.maxLife) * 6)}px monospace`;
        this.ctx.fillText("Z", p.x, p.y);
      } else if (p.kind === "heart") {
        this.ctx.font = "14px sans-serif";
        this.ctx.fillText("♥", p.x, p.y);
      } else if (p.kind === "star") {
        this.ctx.font = "15px sans-serif";
        this.ctx.fillText("★", p.x, p.y);
      } else if (p.kind === "alert") {
        this.ctx.font = "bold 16px monospace";
        this.ctx.fillText("!", p.x, p.y);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 5 + (p.life / p.maxLife) * 5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
      return true;
    });
  }
}
