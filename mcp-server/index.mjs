#!/usr/bin/env node
/**
 * SlimePulse v6.1.0 Zero-Dependency MCP Server (stdio JSON-RPC 2.0)
 * Supports multi-session mitosis, language filePath tinting, and Token / USD cost reporting.
 */
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const EVENT_ENDPOINT = process.env.SLIMEPULSE_URL || "http://127.0.0.1:47890/event";
const USAGE_ENDPOINT = EVENT_ENDPOINT.replace(/\/event$/, "/usage");

const TOOLS = [
  {
    name: "slimepulse_set_state",
    description:
      "Update the SlimePulse optical translucent jelly slime state (IDLE, AI_THINKING, AI_WORKING, AI_JUGGLING, NEED_APPROVAL, TASK_DONE, TASK_ERROR, SLEEPING) with optional multi-session label and active filePath for chromatic language absorption.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: [
            "IDLE", "AI_THINKING", "AI_WORKING", "AI_JUGGLING",
            "NEED_APPROVAL", "TASK_DONE", "TASK_ERROR", "SLEEPING",
          ],
        },
        label: { type: "string", description: "Short speech bubble text (<= 80 chars)" },
        sessionId: { type: "string", description: "Optional session ID for multi-session mini-slime mitosis" },
        projectName: { type: "string", description: "Short repo/folder name shown under the mini-slime" },
        filePath: { type: "string", description: "Active file path (e.g. src/lib.rs) for language tint absorption" },
        durationMs: { type: "integer" },
      },
      required: ["state"],
    },
  },
  {
    name: "slimepulse_notify",
    description: "Trigger a squishy boing chime (TASK_DONE) or urgent approval alert (NEED_APPROVAL).",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        urgent: { type: "boolean" },
        sessionId: { type: "string" },
        projectName: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "slimepulse_report_usage",
    description: "Report AI token consumption & USD cost so the translucent slime grows plumper with golden $ orbs and fires budget burp alerts.",
    inputSchema: {
      type: "object",
      properties: {
        tokensUsed: { type: "integer", description: "Number of tokens consumed in this turn" },
        costUsd: { type: "number", description: "Estimated USD cost for this turn" },
        sessionId: { type: "string" },
        projectName: { type: "string" },
      },
      required: ["tokensUsed", "costUsd"],
    },
  },
];

async function postJson(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "mcp", ...payload }),
      signal: controller.signal,
    });
    return { delivered: res.ok, status: res.status };
  } catch (err) {
    return {
      delivered: false,
      note: "SlimePulse app not running locally (fail-silent).",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleJsonRpc(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "slimepulse-mcp-server", version: "6.1.0" },
      },
    };
  }
  if (method === "notifications/initialized") return null;
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    if (toolName === "slimepulse_set_state") {
      const outcome = await postJson(EVENT_ENDPOINT, {
        state: args.state || "AI_WORKING",
        label: args.label,
        sessionId: args.sessionId,
        projectName: args.projectName,
        filePath: args.filePath,
        durationMs: args.durationMs,
      });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(outcome) }] } };
    }
    if (toolName === "slimepulse_notify") {
      const outcome = await postJson(EVENT_ENDPOINT, {
        state: args.urgent ? "NEED_APPROVAL" : "TASK_DONE",
        label: args.message || "Done!",
        sessionId: args.sessionId,
        projectName: args.projectName,
      });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(outcome) }] } };
    }
    if (toolName === "slimepulse_report_usage") {
      const outcome = await postJson(USAGE_ENDPOINT, {
        tokensUsed: Number(args.tokensUsed) || 0,
        costUsd: Number(args.costUsd) || 0,
        sessionId: args.sessionId,
        projectName: args.projectName,
      });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(outcome) }] } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
  }
  if (id !== undefined) {
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
  return null;
}

const isMainEntry =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainEntry) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed);
      const res = await handleJsonRpc(req);
      if (res) process.stdout.write(JSON.stringify(res) + "\n");
    } catch (err) {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: String(err) } }) + "\n");
    }
  });
}
