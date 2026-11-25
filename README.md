# SlimePulse — 3D Desktop Pet & Companion for Claude Code, Cursor & Codex

**SlimePulse** is an open-source, lightweight (<10 MB) desktop pet for **Claude Code, OpenAI Codex CLI, OpenCode, Gemini CLI, and Cursor**. Unlike static pixel-art pets, SlimePulse renders a real-time 3D refractive jelly in pure WebGL2 (zero image assets) on **macOS, Windows, and Linux**—while guarding against dangerous shell commands (`rm -rf`), melting away automatically during Zoom/OBS screen shares, and turning your mouse into a translucent slime cursor.

<p align="center">
  <img width="768" height="432" alt="SlimePulse 3D desktop pet for Claude Code chomping cursor into a pink slime cursor" src="https://github.com/user-attachments/assets/05715e3f-7c74-4c66-9eea-b15fc6b98e4a" />
</p>

### 25-Second Full Demo

https://github.com/user-attachments/assets/79704576-b0db-4031-a5f9-a357239aef1c

> Zero sprite sheets. Zero heavy Electron RAM bloat. Zero keylogging. Just optical translucent emerald jelly physics that lives on your desktop, watches your AI agents work, tracks real token spend automatically, intercepts dangerous shell commands, and lets you export your Weekly Slime Coding Card.

## ✨ Why SlimePulse? (What No Sprite-Sheet Pet Has)

| Feature | SlimePulse v6.0 | Typical Pixel-Sprite Pets |
| :--- | :--- | :--- |
| **Rendering Engine** | **100% Pure-Code 60 FPS Optical Jelly** (SSS + floor caustics + Fresnel rim + 3D bubbles) | Fixed low-FPS PNG sprite sheets |
| **Tactile Physics** | **Cursor Poke Indentation** + **Wall-Stick & Gravity Slide** | Click-only canned animations |
| **Zero-Config Token Stomach** | **Passively watches** `~/.claude`, `~/.codex`, `~/.local/share/opencode` logs — grows plumper (`1.0x→1.38x`) with floating golden `$` orbs + humorous `$2.00` burp alert | Manual or absent |
| **Dangerous Command Guard** | Auto-escalates `rm -rf`, `git push --force`, `DROP TABLE`, `sudo rm` to urgent red `NEED_APPROVAL` alert | None |
| **Translucent Belly Shelf** | Swallow up to **3 logs/snippets** into the jelly belly (visible floating capsules) & spit back to clipboard | None |
| **Language Tint & Evolution** | Live chromatic tint for `.rs` / `.py` / `.ts` / `.go` + local Commit XP (`Lv.1→Lv.5`) unlocking 5 pure-code accessories | Static skins |
| **Shareable Viral Card** | One-click **Weekly Slime Coding Card PNG (`800×420`)** + 20-line JSON **Slime DNA** | None |

## ⚡ 3-Second Live Sandbox (No Install)
Open `preview.html` directly in any browser (or deploy via the included `.github/workflows/pages.yml` to GitHub Pages) to poke the jelly, fling it onto walls, burn tokens, test multi-session mitosis, and export a Weekly Slime Card PNG.

## 🚀 Quick Start

```bash
# 1. Run environment & 2026 AI agent diagnostics
npm run doctor

# 2. Run all automated functional & audit tests
npm test && npm run test:v2 && npm run test:v3

# 3. Install & run desktop app locally (Tauri 2 + Rust)
npm install
npm run tauri dev
```

## 🤖 Supported 2026 AI Agents
- **Claude Code**: One-click `~/.claude/settings.json` hook installer + passive `~/.claude/projects/*.jsonl` token watcher.
- **OpenAI Codex CLI**: Zero-config passive `~/.codex/sessions/*.jsonl` watcher + `codex://launch` deep-link focus + MCP Server.
- **OpenCode**: Zero-config passive `~/.local/share/opencode` watcher + MCP Server.
- **Gemini CLI & Cursor**: Zero-dependency stdio MCP Server (`node mcp-server/index.mjs`) with `slimepulse_set_state`, `slimepulse_notify`, and `slimepulse_report_usage`.

## 📦 Automated 3-Platform Releases
Push any `v*` tag (e.g. `git tag v6.0.0 && git push --tags`) and `.github/workflows/release.yml` automatically builds macOS Universal (`.dmg`), Windows (`.exe`), and Linux (`.AppImage`) installers.

## 🔒 Privacy Guarantee
Global typing ripples strictly ignore keycodes (`EventType::KeyPress(_)`). Zero telemetry, zero cloud accounts, 100% local-first.

[中文文档 (README_ZH.md)](./README_ZH.md) · MIT License

## 🫧 v6.0 Living Optical Jelly Highlights
- **Optical Color Eyedropper**: Absorb any color into the translucent jelly & copy `#HEX`.
- **Tear-Apart Split & Re-Merge**: Snap off a liquid mini-slime that hops back and merges smoothly.
- **Direct Clickable Belly Capsules**: Click any floating capsule inside the belly to spit that exact snippet to clipboard.
- **Auto-Stealth Meeting Melt**: Detects Zoom / OBS / Teams / Loom / ScreenStudio and melts smoothly into a flat bottom puddle.
- **Late-Night Bioluminescent Jellyfish + Empathy Band-Aid Mode + 3-Line Error Prompt Compressor + Bass Ripple Resonance**.
