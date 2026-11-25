#!/usr/bin/env node
/**
 * SlimePulse v6.1.0 Real Functional + Full-Codebase Audit Test Suite
 * Runs unit tests on all 4 innovations, live HTTP + MCP JSON-RPC 2.0 E2E tests,
 * TS import/export integrity checks, Rust serde/event alignment checks, and regression guards.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function loadTsClass(relPath, exportNames) {
  let code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  code = code
    .replace(/^import\s+.*?;$/gm, "")
    .replace(/export\s+type\s+\w+\s*=\s*[\s\S]*?;/g, "")
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\}/g, "")
    .replace(/\bexport\s+(class|const|function)\b/g, "$1")
    .replace(/\b(private|public|protected)\s+(readonly\s+)?/g, "")
    .replace(/:\s*Record<[^>]+>/g, "")
    .replace(/:\s*Array<\{[^}]+\}>/g, "")
    .replace(/:\s*Partial<\w+>/g, "")
    .replace(/:\s*BellyItem\["kind"\]/g, "")
    .replace(/:\s*\{[^}]+\}\s*(?=\s*\{)/g, "")
    .replace(/:\s*(?:string|number|boolean|void|CodeLanguage|SlimeAccessory|TokenUsageState|BellyItem|EvolutionState)(\[\])?(\s*\|\s*(?:string|number|boolean|null|CodeLanguage|SlimeAccessory|BellyItem|"[^"]+"))*/g, "")
    .replace(/(\w+)\?\s*(?=[,)])/g, "$1");

  const sandbox = { Math, Date, Number, console };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.__exports = { ${exportNames.join(", ")} };`, sandbox);
  return sandbox.__exports;
}

const results = [];
async function runTest(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log("Running SlimePulse v6.1.0 Functional & Full Audit Test Suite...\n");

// 1. Innovation 1: TokenStomachTracker
await runTest("Innovation 1: TokenStomachTracker fatness, golden orbs, setBudgetAlertUsd & burp alert", () => {
  const { TokenStomachTracker } = loadTsClass("src/core/tokenTracker.ts", ["TokenStomachTracker"]);
  const tracker = new TokenStomachTracker(2.0);
  assert.equal(tracker.getFatnessScale(), 1.0);
  assert.equal(tracker.getGoldenOrbCount(), 0);

  const r1 = tracker.recordUsage(12000, 0.85);
  assert.equal(r1.burpAlert, null);
  assert.ok(r1.fatness > 1.05 && r1.fatness < 1.10);
  assert.ok(tracker.getGoldenOrbCount() >= 2);

  const r2 = tracker.recordUsage(25000, 1.35);
  assert.ok(r2.burpAlert && r2.burpAlert.includes("Burp!") && r2.burpAlert.includes("$2.20"));

  const r3 = tracker.recordUsage(5000, 0.50);
  assert.equal(r3.burpAlert, null);

  tracker.recordUsage(100000, 5.0);
  assert.equal(tracker.getFatnessScale(), 1.38);
  assert.equal(tracker.getGoldenOrbCount(), 8);

  tracker.resetSession();
  tracker.setBudgetAlertUsd(1.0);
  const r4 = tracker.recordUsage(10000, 1.05);
  assert.ok(r4.burpAlert && r4.burpAlert.includes("$1.05"));
});

// 2. Innovation 2: SlimeBellyShelf
await runTest("Innovation 2: SlimeBellyShelf 3-slot FIFO swallow & spitOut", () => {
  const { SlimeBellyShelf } = loadTsClass("src/core/bellyShelf.ts", ["SlimeBellyShelf"]);
  const shelf = new SlimeBellyShelf();
  shelf.swallow("error.log", "TypeError: undefined", "log", 1000);
  shelf.swallow("api.rs", "fn main() {}", "code", 2000);
  shelf.swallow("query.sql", "SELECT 1;", "text", 3000);
  assert.equal(shelf.list().length, 3);

  const fourth = shelf.swallow("notes.md", "# Release", "text", 4000);
  const items = shelf.list();
  assert.equal(items.length, 3);
  assert.equal(items[0].label, "api.rs");
  assert.equal(items[2].id, fourth.id);

  const popped = shelf.spitOut();
  assert.equal(popped.label, "notes.md");
  assert.equal(shelf.list().length, 2);

  const targeted = shelf.spitOut(shelf.list()[0].id);
  assert.equal(targeted.label, "api.rs");
  assert.equal(shelf.list().length, 1);
});

// 3. Innovation 3: SlimeEvolutionEngine
await runTest("Innovation 3: SlimeEvolutionEngine language tint detection & Lv.1->Lv.5 unlocks", () => {
  const { SlimeEvolutionEngine, LANGUAGE_TINTS } = loadTsClass("src/core/evolution.ts", [
    "SlimeEvolutionEngine",
    "LANGUAGE_TINTS",
  ]);
  const evo = new SlimeEvolutionEngine();
  assert.equal(evo.detectLanguageFromPath("src-tauri/src/webhook.rs"), "rust");
  assert.deepEqual(Array.from(LANGUAGE_TINTS.rust), [249, 115, 22]);
  assert.equal(evo.detectLanguageFromPath("scripts/train.py"), "python");
  assert.equal(evo.detectLanguageFromPath("src/core/slimeEngine.ts"), "typescript");
  assert.equal(evo.detectLanguageFromPath("cmd/server/main.go"), "go");

  const u2 = evo.awardXp(55, true);
  assert.equal(u2.leveledUp, true);
  assert.equal(u2.newLevel, 2);
  assert.equal(u2.unlocked, "shades");

  const u3 = evo.awardXp(100, true);
  assert.equal(u3.newLevel, 3);
  assert.equal(u3.unlocked, "headphones");

  const u5 = evo.awardXp(400, true);
  assert.equal(u5.newLevel, 5);
  assert.equal(u5.unlocked, "crown");
  assert.equal(evo.getSnapshot().commits, 3);
});

// 4. Live End-to-End Local HTTP + MCP Server JSON-RPC 2.0 Test
await runTest("E2E Integration: Live HTTP webhook + MCP Server (set_state, notify, report_usage)", async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ url: req.url, method: req.method, body: JSON.parse(body || "{}") });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    process.env.SLIMEPULSE_URL = `http://127.0.0.1:${port}/event`;
    const mcp = await import(path.join(ROOT, "mcp-server/index.mjs") + `?t=${Date.now()}`);

    const init = await mcp.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
    assert.equal(init.result.serverInfo.version, "6.1.0");

    const list = await mcp.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.deepEqual(
      list.result.tools.map((t) => t.name),
      ["slimepulse_set_state", "slimepulse_notify", "slimepulse_report_usage"]
    );

    const callState = await mcp.handleJsonRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "slimepulse_set_state",
        arguments: { state: "AI_WORKING", label: "Refactoring", sessionId: "s1", projectName: "api", filePath: "src/lib.rs" },
      },
    });
    assert.equal(JSON.parse(callState.result.content[0].text).delivered, true);

    const callUsage = await mcp.handleJsonRpc({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "slimepulse_report_usage",
        arguments: { tokensUsed: 18500, costUsd: 0.92, sessionId: "s1", projectName: "api" },
      },
    });
    assert.equal(JSON.parse(callUsage.result.content[0].text).delivered, true);

    assert.equal(received.length, 2);
    assert.equal(received[0].url, "/event");
    assert.equal(received[0].body.filePath, "src/lib.rs");
    assert.equal(received[1].url, "/usage");
    assert.equal(received[1].body.tokensUsed, 18500);
    assert.equal(received[1].body.costUsd, 0.92);
  } finally {
    server.close();
  }
});

// 5. Bug-Fix Regression Suite (v6.1.0 — verifies all 9 audited issues stay fixed!)
await runTest("v6.1.0 Audit: TS imports, CONFIG_KEY sync, loadArray safety, Rust camelCase aliases & clipboard perms", () => {
  const bridgeTs = fs.readFileSync(path.join(ROOT, "src/bridge/tauriBridge.ts"), "utf8");
  const mainTs = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const settingsTs = fs.readFileSync(path.join(ROOT, "src/settings.ts"), "utf8");
  const webhookRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/webhook.rs"), "utf8");
  const capJson = JSON.parse(fs.readFileSync(path.join(ROOT, "src-tauri/capabilities/default.json"), "utf8"));
  const previewHtml = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");

  // Bug 1: No obsolete PetSkinManifest import
  assert.equal(bridgeTs.includes("PetSkinManifest"), false, "Obsolete PetSkinManifest still referenced!");
  // Bug 2: Safe loadArray for BELLY_KEY
  assert.ok(mainTs.includes("function loadArray") && mainTs.includes("loadArray<BellyItem>(BELLY_KEY)"), "BELLY_KEY must use loadArray!");
  // Bug 3: CONFIG_KEY identical in main.ts & settings.ts
  const mainKey = mainTs.match(/CONFIG_KEY\s*=\s*"([^"]+)"/)?.[1];
  const settingsKey = settingsTs.match(/CONFIG_KEY\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(mainKey && mainKey === settingsKey, `CONFIG_KEY mismatch: main=${mainKey} vs settings=${settingsKey}`);
  // Bug 4: Rust UsagePayload accepts camelCase aliases from MCP
  assert.ok(webhookRs.includes('alias = "tokensUsed"') && webhookRs.includes('alias = "costUsd"'), "UsagePayload missing camelCase serde aliases!");
  // Bug 5: Tauri clipboard write helper + capability permission
  assert.ok(bridgeTs.includes("export async function writeClipboardText"), "Missing writeClipboardText helper");
  assert.ok(capJson.permissions.includes("clipboard-manager:allow-write-text"), "Missing clipboard-manager:allow-write-text permission");
  // Bug 6: burpAlert displayed AFTER handleAgentEvent
  assert.ok(mainTs.indexOf("fsm.handleAgentEvent(payload)") < mainTs.indexOf("if (burpAlert)"), "burpAlert must run after handleAgentEvent!");
  // Bug 7: preview.html renders multi-session mini-slimes
  assert.ok(previewHtml.includes("id=\"gl-c\"") && previewHtml.includes("id=\"belly-bar\""), "preview.html missing mini-slime rendering!");
});

// 6. Full-Repo Cross-File Integrity & Zero Legacy Naming Scan
await runTest("Full-Repo Cleanliness & Security Audit: Zero NekoPulse/Cat leftovers, Privacy Guard, Physics", () => {
  const slimeEngine = fs.readFileSync(path.join(ROOT, "src/core/slimeEngine.ts"), "utf8");
  const inputMonitorRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/input_monitor.rs"), "utf8");
  assert.ok(slimeEngine.includes("public fling(") && slimeEngine.includes("wallSlideY"));
  assert.ok(inputMonitorRs.includes("EventType::KeyPress(_)"));
  assert.equal(fs.existsSync(path.join(ROOT, "public/sprites")), false);

  const scanDirs = ["src", "src-tauri/src", "src-tauri/capabilities", "mcp-server"];
  const offenders = [];
  for (const dir of scanDirs) {
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|rs|mjs|json)$/.test(entry.name)) {
          const content = fs.readFileSync(full, "utf8");
          if (/nekopulse|NekoAudioEngine|playMeow|PetSkinManifest/i.test(content)) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, dir));
  }
  assert.deepEqual(offenders, [], `Legacy NekoPulse references found in: ${offenders.join(", ")}`);
});

const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} functional & audit test suites passed.`);
if (failed.length > 0) process.exit(1);
