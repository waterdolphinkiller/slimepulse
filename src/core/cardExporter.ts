import type { SlimeDNA } from "./types.ts";
import type { EvolutionState } from "./evolution.ts";
import type { TokenUsageState } from "./tokenTracker.ts";

export interface SlimeCardStats {
  dna: SlimeDNA;
  evolution: EvolutionState;
  tokens: TokenUsageState;
  bellyCount: number;
}

/**
 * Pure-Code Weekly Slime Coding Card Exporter (800x420 PNG).
 * Composites the live optical translucent jelly canvas + XP/Token/Language stats
 * into a dark-glass shareable card ready for X / Reddit / Discord / GitHub README.
 */
export function renderSlimeCardDataUrl(
  petCanvas: HTMLCanvasElement,
  stats: SlimeCardStats
): string {
  const W = 800;
  const H = 420;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) return "";

  // 1. Dark glass gradient background + subtle developer grid
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07111c");
  bg.addColorStop(1, "#0f2235");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(74, 222, 128, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Outer emerald card border
  ctx.strokeStyle = "rgba(74, 222, 128, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 22);
  ctx.stroke();

  // 2. Left glass pedestal + live translucent slime snapshot
  ctx.fillStyle = "rgba(15, 29, 46, 0.72)";
  ctx.strokeStyle = "rgba(74, 222, 128, 0.25)";
  ctx.beginPath();
  ctx.roundRect(38, 42, 290, 336, 18);
  ctx.fill();
  ctx.stroke();
  ctx.drawImage(petCanvas, 43, 66, 280, 280);

  // 3. Right stats column
  const rx = 356;
  ctx.fillStyle = "#86efac";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("SlimePulse v3.0", rx, 78);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "15px ui-monospace, monospace";
  ctx.fillText(`WEEKLY CODING CARD · ${stats.tokens.dateKey}`, rx, 106);

  const metrics: Array<[string, string]> = [
    ["SLIME LEVEL", `Lv.${stats.evolution.level}  (${stats.evolution.xp} XP · ${stats.evolution.commits} commits)`],
    ["TOKENS EATEN", `${stats.tokens.todayTokens.toLocaleString()} toks · $${stats.tokens.todayCostUsd.toFixed(2)}`],
    ["LANGUAGE TINT", stats.evolution.activeLanguage.toUpperCase()],
    ["BELLY & DNA", `${stats.bellyCount}/3 capsules · ${stats.dna.flavor} + ${stats.dna.accessory}`],
  ];

  metrics.forEach(([label, val], idx) => {
    const y = 144 + idx * 54;
    ctx.fillStyle = "rgba(11, 19, 30, 0.78)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(rx, y, 404, 44, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText(label, rx + 14, y + 16);

    ctx.fillStyle = "#f0fdf4";
    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.fillText(val, rx + 14, y + 34);
  });

  // Footer badge
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 12px ui-monospace, monospace";
  ctx.fillText("100% Pure-Code 60 FPS Optical Jelly · github.com/slimepulse", rx, 376);

  return out.toDataURL("image/png");
}

export function downloadSlimeCardPng(
  petCanvas: HTMLCanvasElement,
  stats: SlimeCardStats
): boolean {
  const url = renderSlimeCardDataUrl(petCanvas, stats);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = `slimepulse-card-${stats.tokens.dateKey}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
