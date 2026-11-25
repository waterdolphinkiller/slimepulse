#!/usr/bin/env node
/**
 * SlimePulse v6.1.0 Comprehensive Verification & Regression Suite
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { handleJsonRpc } from "../mcp-server/index.mjs";

// 1. Verify ZERO legacy cat spritesheets remain
assert.ok(!fs.existsSync("public/skins"), "Legacy cat public/skins/ must be removed!");
assert.ok(!fs.existsSync("src/core/rubberHoseRig.ts"), "Legacy rubberHoseRig.ts must be removed!");
console.log("✓ Brand purification passed: 0 legacy cat assets remain.");

// 2. Verify all JSON configs parse cleanly
for (const rel of [
  "package.json",
  "tsconfig.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/capabilities/default.json",
  "mcp-server/package.json",
  "examples/claude-code-hooks.json",
]) {
  const parsed = JSON.parse(fs.readFileSync(rel, "utf8"));
  assert.ok(parsed && typeof parsed === "object", `${rel} invalid JSON`);
}
console.log("✓ All 6 JSON configs parsed cleanly.");

// 3. MCP Server JSON-RPC 2.0 tests (including multi-session fields)
const initRes = await handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
assert.equal(initRes.result.serverInfo.name, "slimepulse-mcp-server");
const listRes = await handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
assert.equal(listRes.result.tools[0].name, "slimepulse_set_state");
assert.ok("sessionId" in listRes.result.tools[0].inputSchema.properties);
const callRes = await handleJsonRpc({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "slimepulse_notify", arguments: { message: "Allow bash?", urgent: true, sessionId: "api", projectName: "api" } },
});
assert.ok(callRes.result.content[0].text.includes("delivered"));
console.log("✓ SlimePulse MCP Server initialize, tools/list, and multi-session tools/call passed.");

// 4. Verify all P0 + P1 + P2 PM features in source
const libRs = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
assert.ok(libRs.includes("focus_terminal_window") && libRs.includes("toggle_zen_hide"), "Missing P0 focus_terminal_window or P1 toggle_zen_hide");
assert.ok(libRs.includes("default_window_icon") && libRs.includes("prevent_close()"), "Tray icon / settings hide guard failed");

const webhookRs = fs.readFileSync("src-tauri/src/webhook.rs", "utf8");
assert.ok(webhookRs.includes("session_id") && webhookRs.includes("extract_project_name"), "Missing P0 multi-session extraction in webhook.rs");

const slimeTs = fs.readFileSync("src/core/slimeEngine.ts", "utf8");
assert.ok(slimeTs.includes("pokeAt(") && slimeTs.includes("digestingLabel") && slimeTs.includes("drawAccessory("), "Missing P1/P2 slimeEngine features");

const claudeRs = fs.readFileSync("src-tauri/src/claude_hooks.rs", "utf8");
assert.ok(claudeRs.includes('target_os = "windows"') && claudeRs.includes("curl.exe"), "Windows hooks guard failed");

const inputRs = fs.readFileSync("src-tauri/src/input_monitor.rs", "utf8");
assert.ok(inputRs.includes("KeyPress(_)") && inputRs.includes("catch_unwind"), "Privacy & panic guard failed");

const previewSize = fs.statSync(path.resolve("preview.html")).size;
assert.ok(previewSize < 44000, `preview.html should be ultra-light (<44KB), got ${previewSize}`);

console.log(`✓ All P0/P1/P2 feature guards & privacy audit PASSED (preview.html: ${(previewSize / 1024).toFixed(1)} KB).`);
console.log("All SlimePulse v6.1.0 automated tests PASSED!");
