import type { AppConfig } from "./types.ts";

const SYSTEM_PROMPT =
  "You are SlimePulse, a concise translucent jelly slime desktop assistant. Given a pasted error log, code snippet, or foreign text, reply in AT MOST 3 short bullet lines (<= 220 chars total): either the root cause + fix, or a clear translation. No fluff.";

/**
 * Zero-Latency Local Stacktrace -> 3-Line Minimal Repro Prompt Compressor.
 * Strips noisy node_modules / internal runtime frames and packs the root error + top user frames
 * into a crisp prompt ready to paste straight into Claude Code or Codex.
 */
export function compressErrorToPrompt(rawLog: string): string {
  const lines = rawLog
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "Fix this issue: (empty log)";

  const errorLine =
    lines.find((l) => /(error|exception|panic|failed|traceback|typeerror|referenceerror)/i.test(l)) ??
    lines[0];

  const userFrames = lines
    .filter(
      (l) =>
        (/^\s*(at\s+|File\s+"|-->\s+)/i.test(l) || /\.(ts|tsx|js|py|rs|go):\d+/i.test(l)) &&
        !/(node_modules|node:internal|site-packages|\.cargo\/registry)/i.test(l)
    )
    .slice(0, 2);

  const parts = [`Fix this error: ${errorLine.slice(0, 140)}`];
  if (userFrames.length > 0) {
    parts.push(`Location: ${userFrames.join(" | ").slice(0, 160)}`);
  }
  parts.push("Explain root cause in 1 line and provide the minimal patch.");
  return parts.join("\n");
}

export async function analyzeClipboardSnippet(
  snippet: string,
  config: AppConfig
): Promise<string> {
  const trimmed = snippet.trim().slice(0, 3000);
  if (!trimmed) {
    return "Clipboard is empty! Copy an error or snippet first.";
  }

  try {
    if (config.aiProvider === "ollama") {
      const res = await fetch(config.aiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.aiModel,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: trimmed },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content?.trim() || "Bloop? Empty response from Ollama.";
    }

    if (config.aiProvider === "anthropic") {
      const res = await fetch(config.aiEndpoint || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.aiModel || "claude-3-5-haiku-latest",
          max_tokens: 180,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: trimmed }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const data = (await res.json()) as { content?: Array<{ text?: string }> };
      return data.content?.[0]?.text?.trim() || "Bloop? Empty response.";
    }

    const res = await fetch(config.aiEndpoint || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.aiApiKey ? { Authorization: `Bearer ${config.aiApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.aiModel || "gpt-4o-mini",
        max_tokens: 180,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || "Bloop? Empty response.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `AI unreachable (${msg}). Check Settings.`;
  }
}
