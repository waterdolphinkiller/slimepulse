#!/usr/bin/env node
/**
 * SlimePulse v6.1.0 Zero-Dependency Environment & Multi-Agent Doctor CLI
 * Run: `npm run doctor`
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = os.homedir();
const PORT = Number(process.env.SLIMEPULSE_PORT || 47890);

function hasCmd(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function checkWebhook() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 700);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: ctrl.signal });
    if (!res.ok) return { running: false };
    const data = await res.json();
    return { running: true, version: data.version };
  } catch {
    return { running: false };
  } finally {
    clearTimeout(timer);
  }
}

console.log("🟢 SlimePulse v6.1.0 Doctor — Environment & 2026 AI Agent Check\n");

// 1. Runtime & Build Toolchain
console.log("1. Toolchain:");
console.log(`   [OK]   Node.js ${process.version}`);
console.log(`   [${hasCmd("cargo") ? "OK" : "WARN"}] Cargo / Rust ${hasCmd("cargo") ? "detected (ready for `npm run tauri build`)" : "not installed (preview.html & MCP Server still work)"}`);

// 2. Installed 2026 AI Coding Agents
console.log("\n2. Detected AI Coding Agents:");
const agents = [
  { name: "Claude Code", paths: [path.join(HOME, ".claude")], mode: "Hooks + Passive Log Watcher" },
  { name: "OpenAI Codex CLI", paths: [path.join(HOME, ".codex")], mode: "Passive Log Watcher + MCP" },
  { name: "OpenCode", paths: [path.join(HOME, ".config", "opencode"), path.join(HOME, ".local", "share", "opencode")], mode: "Passive Log Watcher + MCP" },
  { name: "Gemini CLI", paths: [path.join(HOME, ".gemini")], mode: "MCP Server" },
  { name: "Cursor", paths: [path.join(HOME, ".cursor")], mode: "MCP Server" },
];

let detectedCount = 0;
for (const a of agents) {
  const found = a.paths.some((p) => fs.existsSync(p));
  if (found) detectedCount++;
  console.log(`   [${found ? "FOUND" : " --  "}] ${a.name.padEnd(18)} -> ${a.mode}`);
}
if (detectedCount === 0) {
  console.log("   (No local agent config folders detected yet — MCP & preview.html still work standalone.)");
}

// 3. Claude Code Hook Status
const claudeSettings = path.join(HOME, ".claude", "settings.json");
let hookInstalled = false;
if (fs.existsSync(claudeSettings)) {
  try {
    const raw = fs.readFileSync(claudeSettings, "utf8");
    hookInstalled = raw.includes("/claude-hook") && raw.includes("127.0.0.1");
  } catch {
    hookInstalled = false;
  }
}
console.log("\n3. Integrations & Live App:");
console.log(`   [${hookInstalled ? "OK" : "INFO"}] Claude Code Hooks: ${hookInstalled ? "Installed in ~/.claude/settings.json" : "Not configured yet (use SlimePulse tray -> One-Click Claude Code Hooks)"}`);

const live = await checkWebhook();
console.log(`   [${live.running ? "OK" : "INFO"}] Local Webhook (127.0.0.1:${PORT}): ${live.running ? `Running (v${live.version})` : "App not currently running"}`);
console.log("\nDone! Tip: Open preview.html in any browser to test SlimePulse in 3 seconds.");
