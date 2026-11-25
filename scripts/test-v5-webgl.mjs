#!/usr/bin/env node
/**
 * SlimePulse v5.1.0 WebGL2 GLSL Raymarched SDF + Living Soul Engine Test Suite
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function loadSoulClass() {
  let code = fs.readFileSync(path.join(ROOT, "src/core/livingSoul.ts"), "utf8");
  code = code
    .replace(/export\s+type\s+\w+\s*=\s*[\s\S]*?;/g, "")
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\}/g, "")
    .replace(/\bexport\s+class\b/g, "class")
    .replace(/\b(private|public)\s+/g, "")
    .replace(/:\s*(?:SoulMood|SoulSnapshot|string|number|boolean|void|Date)(\s*\|\s*(?:SoulMood|string|null))*/g, "");
  code=code.replace(/^\s*export\s+/gm,""); const sandbox = { Math, Date, Number, console };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.__exports = { SlimeLivingSoul };`, sandbox);
  return sandbox.__exports.SlimeLivingSoul;
}

console.log("Running SlimePulse v5.1.0 WebGL2 + Living Soul Audit Suite...\n");

runTest("v5.0 WebGL2 GLSL ES 3.00 Shader Primitives & Uniform Parity", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/core/webglSlimeEngine.ts"), "utf8");
  assert.ok(src.includes("#version 300 es"));
  assert.ok(src.includes("float smin(") && src.includes("float sdPudding("));
  assert.ok(src.includes("refract(rd, N, 1.0 / 1.36)"));
  assert.ok(src.includes("exp(-thickness") && src.includes("renderInternalBubbles"));
  const glslUniforms = [...src.matchAll(/uniform\s+\w+\s+(u\w+)\s*;/g)].map((m) => m[1]);
  for (const u of glslUniforms) {
    assert.ok(src.includes(`"${u}"`), `Uniform ${u} missing in TS uniform list!`);
  }
});

runTest("v5.1 Living Soul: Sneeze crown-tilt -> straighten, Bubble POP startle, Tease 5x Cursor Gulp, Dizzy -> Pout -> Forgive", () => {
  const SlimeLivingSoul = loadSoulClass();
  const soul = new SlimeLivingSoul();

  // 1. Sneeze tilts crown askew then springs back toward 0
  soul.triggerSneeze();
  const s1 = soul.tick(0.05, true, false);
  assert.equal(s1.mood, "SNEEZING");
  assert.ok(s1.crownTilt > 0.3, `Expected crownTilt > 0.3, got ${s1.crownTilt}`);
  let sEnd = s1;
  for (let i = 0; i < 90; i++) sEnd = soul.tick(0.02, true, false);
  assert.equal(sEnd.mood, "NORMAL");
  assert.ok(Math.abs(sEnd.crownTilt) < 0.05, `Crown should straighten back, got ${sEnd.crownTilt}`);

  // 2. Bored bubble inflates then POPs into STARTLED
  soul.triggerBlowBubble();
  let startled = false;
  for (let i = 0; i < 140; i++) {
    const snap = soul.tick(0.02, true, false);
    if (snap.mood === "STARTLED") startled = true;
  }
  assert.equal(startled, true, "Bubble should pop into STARTLED mood!");

  // 3. Tease 5x across face -> SWALLOW_CURSOR
  let now = 1000;
  let caught = null;
  for (let i = 0; i < 5; i++) {
    caught = soul.recordCursorSwipe(i % 2 === 0 ? 15 : -15, 16, now);
    now += 150;
  }
  assert.equal(caught, "SWALLOW_CURSOR");
  assert.equal(soul.tick(0.02, false, false).cursorTrapped, true);

  // 4. Dizzy -> transitions to POUTING -> petting forgives
  soul.triggerDizzy();
  let pouted = false;
  for (let i = 0; i < 120; i++) {
    if (soul.tick(0.02, false, false).mood === "POUTING") pouted = true;
  }
  assert.equal(pouted, true, "Dizzy must transition into 5s POUTING!");
  assert.equal(soul.forgivePout(), true);

  // 5. File taste & emotional memory
  assert.ok(soul.reactToFile("crash.log")?.includes("Sour"));
  assert.ok(soul.reactToBuildSuccess(3)?.includes("FINALLY GREEN"));
});

runTest("v5.1 preview.html WebGL2 + Living Soul Controls Syntax & DOM Audit", () => {
  const html = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Missing inline script in preview.html");
  new vm.Script(script);
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of script.matchAll(/getElementById\("([^"]+)"\)/g)) {
    assert.ok(ids.has(m[1]), `preview.html missing DOM id: ${m[1]}`);
  }
  assert.ok(html.includes("btn-sneeze") && html.includes("btn-bubble") && html.includes("btn-dizzy") && html.includes("btn-chomp") && html.includes("btn-nod"));
});


runTest("v5.2 Usability & i18n: zh/en/ja localization, MCP JSON snippet, S/M/L scale, lockPosition, ecoMode & onboarding", () => {
  const i18nSrc = fs.readFileSync(path.join(ROOT, "src/core/i18n.ts"), "utf8");
  const mainSrc = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const setHtml = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
  const setTs = fs.readFileSync(path.join(ROOT, "src/settings.ts"), "utf8");

  assert.ok(i18nSrc.includes("resolveLocale") && i18nSrc.includes("MCP_SNIPPET_JSON"));
  assert.ok(i18nSrc.includes("简体中文") || i18nSrc.includes("嗨！把鼠标划过我"));
  assert.ok(i18nSrc.includes("こんにちは！"));
  assert.ok(mainSrc.includes("ONBOARD_KEY") && mainSrc.includes("config.lockPosition") && mainSrc.includes("config.ecoMode") && mainSrc.includes("config.petScale"));
  assert.ok(setHtml.includes("locale-select") && setHtml.includes("scale-select") && setHtml.includes("lock-position") && setHtml.includes("eco-mode") && setHtml.includes("btn-copy-mcp") && setHtml.includes("agent-list"));
  assert.ok(setTs.includes("detect_installed_agents") && setTs.includes("MCP_SNIPPET_JSON"));
});


runTest("v6.0 Ultimate 10/10 Audit: Crystal Dispersion, WebGL2 skipBody, Desktop Soul Sync, Tray Mute, Window Pos & MCP Auto-Writer", () => {
  const wg = fs.readFileSync(path.join(ROOT, "src/core/webglSlimeEngine.ts"), "utf8");
  const ren = fs.readFileSync(path.join(ROOT, "src/core/renderer.ts"), "utf8");
  const mainTs = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const libRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/lib.rs"), "utf8");
  const chRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/claude_hooks.rs"), "utf8");

  assert.ok(wg.includes("1.0 / 1.33") && wg.includes("1.0 / 1.40"), "Missing 3-channel crystal chromatic dispersion!");
  assert.ok(ren.includes("Boolean(this.glShader)") && ren.includes("setSoulSnapshot"), "Desktop WebGL2 must skip redundant 2D body & sync SoulSnapshot!");
  assert.ok(mainTs.includes("recordCursorSwipe") && mainTs.includes("onToggleMute") && mainTs.includes("save_window_position"));
  assert.ok(libRs.includes("toggle_mute") && libRs.includes("restore_window_position") && libRs.includes("install_mcp_for_agent"));
  assert.ok(chRs.includes("pub fn install_mcp_for_agent"));
});


runTest("v6.1 Pink State & Translucent Slime Cursor Coating after SWALLOW_CURSOR spit", () => {
  const lsSrc = fs.readFileSync(path.join(ROOT, "src/core/livingSoul.ts"), "utf8");
  const mainSrc = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const prevSrc = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");
  assert.ok(lsSrc.includes("export function buildSlimeCursorCss") && lsSrc.includes("cursorSlimed: this.slimedCursorTimer > 0"));
  assert.ok(mainSrc.includes("buildSlimeCursorCss(rgb)") && prevSrc.includes("buildSlimeCursor(mid)"));
  assert.ok(prevSrc.includes("🌸 Pink Love (粉色状态)") && prevSrc.includes('st === "PETTING" ? PAL["berry-pink"]'));
});

const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} v5.1.0 WebGL2 + Living Soul suites passed.`);
if (failed.length > 0) process.exit(1);
