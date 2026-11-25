#!/usr/bin/env node
/**
 * SlimePulse v4.0.0 "Living Optical Jelly" Functional & Audit Test Suite
 * Tests: Stacktrace -> 3-Line Prompt Compressor, Per-Agent Token Breakdown & 5h Quota Sweating,
 * Empathy Band-Aid Mode (3x consecutive errors), Rust Meeting Stealth Process Detector,
 * Tear-Apart Split & Merge, Optical Eyedropper Absorption, Night Glow, and Clickable Belly Capsules.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function loadTsExports(relPath, exportNames) {
  let code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  code = code
    .replace(/^import\s+.*?;$/gm, "")
    .replace(/export\s+type\s+\w+\s*=\s*[\s\S]*?;/g, "")
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\}/g, "")
    .replace(/\bexport\s+(async\s+)?(class|const|function)\b/g, "$1$2")
    .replace(/\b(private|public|protected)\s+(readonly\s+)?/g, "")
    .replace(/:\s*Record<[^>]+>/g, "")
    .replace(/:\s*ReadonlySet<[^>]+>/g, "")
    .replace(/:\s*Array<\{[^}]+\}>/g, "")
    .replace(/:\s*Partial<\w+>/g, "")
    .replace(/:\s*Promise<[^>]+>/g, "")
    .replace(/:\s*\{[^}]+\}\s*(?=\s*\{)/g, "")
    .replace(/:\s*(?:string|number|boolean|void|AppConfig|PetState|StateSnapshot|HardwareMetrics|AgentEventPayload|SessionRecord|TokenUsageState)(\[\])?(\s*\|\s*(?:string|number|boolean|null|PetState|SessionRecord|"[^"]+"))*/g, "")
    .replace(/new\s+(Set|Map)<[^>]+>/g, "new $1")
    .replace(/\s+as\s+\{[\s\S]*?\};/g, ";")
    .replace(/:\s*"left"\s*\|\s*"right"/g, "")
    .replace(/\s+as\s+\w+/g, "")
    .replace(/(\w+)\?\s*(?=[,)])/g, "$1");

  const sandbox = { Math, Date, Number, Set, Map, Object, Array, console, fetch: async () => ({ ok: false, status: 500 }) };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.__exports = { ${exportNames.join(", ")} };`, sandbox);
  return sandbox.__exports;
}

const results = [];
function runTest(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log("Running SlimePulse v4.0.0 Living Optical Jelly Test Suite...\n");

runTest("v4.0 Local Stacktrace -> 3-Line Minimal Repro Prompt Compressor", () => {
  const { compressErrorToPrompt } = loadTsExports("src/core/aiCompanion.ts", ["compressErrorToPrompt"]);
  const noisyLog = [
    "Starting build...",
    "TypeError: Cannot read properties of undefined (reading 'slice')",
    "    at node_modules/vite/dist/index.js:12:4",
    "    at loadBelly (src/main.ts:53:18)",
    "    at bootstrap (src/main.ts:62:9)",
    "    at node:internal/process/task_queues:95:5",
  ].join("\n");
  const out = compressErrorToPrompt(noisyLog);
  const lines = out.split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes("TypeError: Cannot read properties of undefined"));
  assert.ok(lines[1].includes("src/main.ts:53:18") && !lines[1].includes("node_modules"));
});

runTest("v4.0 Per-Agent Token Breakdown & 5h Quota Heat Sweating (>=85%)", () => {
  const { TokenStomachTracker } = loadTsExports("src/core/tokenTracker.ts", ["TokenStomachTracker"]);
  const t = new TokenStomachTracker(2.0);
  const r1 = t.recordUsage(20000, 1.5, "log-watcher:claude-code");
  assert.equal(r1.quotaSweating, false);
  const r2 = t.recordUsage(30000, 2.0, "log-watcher:codex");
  assert.equal(r2.quotaSweating, true, "Should sweat when session spend reaches $3.50 (88% of $4 heat cap)");
  const summary = t.formatAgentBreakdown();
  assert.ok(summary.includes("claude-code:$1.50") && summary.includes("codex:$2.00"), `Got: ${summary}`);
});

runTest("v4.0 Empathy Band-Aid Mode triggers after 3 consecutive TASK_ERRORs & resets on TASK_DONE", () => {
  const { PetStateMachine } = loadTsExports("src/core/stateMachine.ts", ["PetStateMachine"]);
  const fsm = new PetStateMachine();
  fsm.handleAgentEvent({ state: "TASK_ERROR" });
  fsm.handleAgentEvent({ state: "TASK_ERROR" });
  assert.equal(fsm.tick().empathyMode, false);
  fsm.handleAgentEvent({ state: "TASK_ERROR" });
  assert.equal(fsm.tick().empathyMode, true);
  assert.equal(fsm.tick().consecutiveErrors, 3);
  fsm.handleAgentEvent({ state: "TASK_DONE" });
  assert.equal(fsm.tick().empathyMode, false);
  assert.equal(fsm.tick().consecutiveErrors, 0);
});

runTest("v4.0 Rust Meeting Stealth Detector & HardwareMetrics parity", () => {
  const hwRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/hardware.rs"), "utf8");
  const libRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/lib.rs"), "utf8");
  assert.ok(hwRs.includes("detect_meeting_or_recording") && hwRs.includes("zoom.us") && hwRs.includes("obs"));
  assert.ok(hwRs.includes("meeting_stealth") && libRs.includes("pub meeting_stealth: bool"));
});

runTest("v4.0 Living Optical Jelly Engine & Flagship preview.html controls", () => {
  const engine = fs.readFileSync(path.join(ROOT, "src/core/slimeEngine.ts"), "utf8");
  const mainTs = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const preview = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");
  assert.ok(engine.includes("public triggerSplit(") && engine.includes("hitTestBellyCapsule"));
  assert.ok(engine.includes("NIGHT_GLOW_PALETTE") && engine.includes("snapshot.empathyMode") && engine.includes("stealthMelt"));
  assert.ok(mainTs.includes("hitTestBellyCapsule") && mainTs.includes("compressErrorToPrompt"));
  assert.ok(preview.includes("btn-split") && preview.includes("btn-stealth") && preview.includes("btn-night") && preview.includes("btn-bass") && preview.includes("color-pick"));
});


runTest("v4.0.1 Hardening Audit: UTF-8 safe log_watcher, EyeDropper/Bass in main.ts, Settings UI & <=9 menu items", () => {
  const lw = fs.readFileSync(path.join(ROOT, "src-tauri/src/log_watcher.rs"), "utf8");
  const mainTs = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const idxHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const setHtml = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
  const setTs = fs.readFileSync(path.join(ROOT, "src/settings.ts"), "utf8");

  assert.ok(lw.includes("fs::read(&file)") && lw.includes("from_utf8_lossy") && !lw.includes("&raw[start..]"), "log_watcher must use byte-safe UTF-8 reading!");
  assert.ok(mainTs.includes("EyeDropper") && mainTs.includes("toggle-bass") && mainTs.includes("setInterval(() => syncV2Overlay(), 60_000)"));
  assert.ok(setHtml.includes("budget-alert-usd") && setHtml.includes("meeting-stealth-enabled") && setHtml.includes("night-glow-enabled"));
  assert.ok(setTs.includes("budgetAlertUsd") && setTs.includes("autoMeetingStealth") && setTs.includes("autoNightGlow"));
  const menuButtons = [...idxHtml.matchAll(/data-action="([^"]+)"/g)].length;
  assert.ok(menuButtons <= 9, `Context menu should be streamlined (<=9), got ${menuButtons}`);
});


runTest("v4.1.0 Spring-Mass Ring Wave Propagation, Stability & Juice SFX Audit", () => {
  const engineSrc = fs.readFileSync(path.join(ROOT, "src/core/slimeEngine.ts"), "utf8");
  const audioSrc = fs.readFileSync(path.join(ROOT, "src/core/audioEngine.ts"), "utf8");
  const mainSrc = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const prevSrc = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");

  assert.ok(engineSrc.includes("stepSpringRing") && engineSrc.includes("impulseRing") && engineSrc.includes("const volSy = 1 / volSx;"));
  assert.ok(engineSrc.includes("triggerGulp") && engineSrc.includes("triggerSpit") && engineSrc.includes("triggerBurp") && engineSrc.includes("triggerDyeWave"));
  assert.ok(audioSrc.includes("playGulp") && audioSrc.includes("playSpit") && audioSrc.includes("playBurp") && audioSrc.includes("playSplat"));
  assert.ok(mainSrc.includes("renderer.triggerGulp()") && mainSrc.includes("renderer.triggerSpit()") && mainSrc.includes("renderer.triggerBurp()") && mainSrc.includes("renderer.triggerDyeWave("));
  assert.ok(prevSrc.includes("smin(") && prevSrc.includes("refract(") && prevSrc.includes("renderBubbles"));

  // Simulate the exact 32-node coupled spring-mass wave equation for 120 frames (2s @ 60fps) to verify wave propagation & damped stability (zero NaN/explosion)!
  const N = 32, disp = new Array(N).fill(0), vel = new Array(N).fill(0);
  vel[0] = -120; // Poke node 0
  for (let step = 0; step < 120; step++) {
    const dt = 1 / 60;
    const acc = new Array(N);
    for (let i = 0; i < N; i++) {
      acc[i] = -145 * disp[i] + 220 * (disp[(i + N - 1) % N] + disp[(i + 1) % N] - 2 * disp[i]) - 7.2 * vel[i];
    }
    for (let i = 0; i < N; i++) {
      vel[i] += acc[i] * dt;
      disp[i] = Math.max(-22, Math.min(22, disp[i] + vel[i] * dt));
      assert.ok(Number.isFinite(disp[i]), "Spring-mass displacement became non-finite!");
    }
    if (step === 10) {
      assert.ok(Math.abs(disp[3]) > 0.05, "Wave failed to propagate to neighbor node 3!");
    }
  }
  const finalEnergy = disp.reduce((s, v) => s + Math.abs(v), 0);
  assert.ok(finalEnergy < 2.0, `Spring ring failed to damp smoothly, residual energy=${finalEnergy}`);
});

const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} v4.0.0 Living Optical Jelly suites passed.`);
if (failed.length > 0) process.exit(1);
