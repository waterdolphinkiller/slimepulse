#!/usr/bin/env node
/**
 * SlimePulse v6.1.0 Release-Readiness & Feature Audit Test Suite
 * Verifies: Passive Multi-Agent Log Watcher, Dangerous Command Guard, Weekly Card PNG Exporter,
 * SlimePulse Doctor CLI execution, GitHub Actions CI/Release/Pages workflows, and cross-file integrity.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

console.log("Running SlimePulse v6.1.0 Release-Readiness Test Suite...\n");

runTest("v6.0 Passive Log Watcher (Claude Code, Codex CLI, OpenCode) & Lib Registration", () => {
  const watcher = fs.readFileSync(path.join(ROOT, "src-tauri/src/log_watcher.rs"), "utf8");
  const libRs = fs.readFileSync(path.join(ROOT, "src-tauri/src/lib.rs"), "utf8");
  assert.ok(watcher.includes('.join(".claude").join("projects")'), "Missing Claude Code log root");
  assert.ok(watcher.includes('.join(".codex").join("sessions")'), "Missing Codex CLI log root");
  assert.ok(watcher.includes('.join("opencode")'), "Missing OpenCode log root");
  assert.ok(watcher.includes("estimate_cost_usd") && watcher.includes("slimepulse://agent-event"));
  assert.ok(libRs.includes("mod log_watcher;") && libRs.includes("start_passive_log_watcher"));
  assert.ok(libRs.includes("fn detect_installed_agents()") && libRs.includes("codex://launch"));
});

runTest("v6.0 Dangerous Command Guard (rm -rf, git push --force, DROP TABLE) in webhook.rs", () => {
  const wh = fs.readFileSync(path.join(ROOT, "src-tauri/src/webhook.rs"), "utf8");
  assert.ok(wh.includes("fn detect_dangerous_command"), "Missing detect_dangerous_command");
  assert.ok(wh.includes("rm -rf") && wh.includes("git push --force") && wh.includes("drop table"));
  assert.ok(wh.includes("⚠️ DANGER"), "Missing DANGER escalation label");
});

runTest("v6.0 Weekly Slime Coding Card PNG Exporter (cardExporter.ts + main.ts + preview.html)", () => {
  const cardTs = fs.readFileSync(path.join(ROOT, "src/core/cardExporter.ts"), "utf8");
  const mainTs = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const previewHtml = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");

  assert.ok(cardTs.includes("export function renderSlimeCardDataUrl") && cardTs.includes("export function downloadSlimeCardPng"));
  assert.ok(mainTs.includes("downloadSlimeCardPng") && mainTs.includes('action === "export-card"'));
  assert.ok(indexHtml.includes('data-action="export-card"'));
  assert.ok(previewHtml.includes("btn-export-card") && previewHtml.includes("WEEKLY CODING CARD"));
});

runTest("v6.0 SlimePulse Doctor CLI runs cleanly with exit code 0", () => {
  const out = execSync("node scripts/slimepulse-doctor.mjs", { cwd: ROOT, encoding: "utf8" });
  assert.ok(out.includes("SlimePulse v6.1.0 Doctor"));
  assert.ok(out.includes("Claude Code") && out.includes("OpenAI Codex CLI") && out.includes("OpenCode"));
});

runTest("v6.0 GitHub Actions CI, 3-Platform Release & Pages Live Demo Workflows", () => {
  const ci = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const rel = fs.readFileSync(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
  const pages = fs.readFileSync(path.join(ROOT, ".github/workflows/pages.yml"), "utf8");
  assert.ok(ci.includes("npm run test:v3") && ci.includes("npm run build"));
  assert.ok(rel.includes("tauri-apps/tauri-action") && rel.includes("macos-latest") && rel.includes("windows-latest") && rel.includes("ubuntu-22.04"));
  assert.ok(pages.includes("cp preview.html _site/index.html") && pages.includes("deploy-pages"));
});

runTest("v6.0 Unified Version 6.1.0 Across All Manifests", () => {
  for (const p of ["package.json", "mcp-server/package.json", "src-tauri/tauri.conf.json"]) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
    assert.equal(j.version, "6.1.0", `${p} version must be 6.1.0`);
  }
  const cargo = fs.readFileSync(path.join(ROOT, "src-tauri/Cargo.toml"), "utf8");
  assert.ok(cargo.includes('version = "6.1.0"'));
});

const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} v6.1.0 release-readiness suites passed.`);
if (failed.length > 0) process.exit(1);
