# 🟢 SlimePulse v6.0

**100% 纯代码 60 FPS 光学半透明果冻 AI 桌面伴侣（`<10MB`）** —— 原生适配 **Claude Code、OpenAI Codex CLI、OpenCode、Gemini CLI、Cursor 与 MCP**。

> 零精灵图素材、零 Electron 内存臃肿、零按键内容采集。它不仅是一只会实时被鼠标戳出凹陷、能甩上墙拍扁滑落的透明绿色史莱姆，更是一个零配置追踪 Token 消耗、拦截危险 Shell 命令、支持多终端分裂与一键导出“本周编程战报卡”的极客生产力工具。

## ✨ 为什么选择 SlimePulse？（竞品没有的独家体验）
1. **零配置被动监听真实 Token 消耗（Rust `log_watcher`）**：后台增量扫描 `~/.claude/projects/`、`~/.codex/sessions/`、`~/.local/share/opencode/` 本地日志，自动让史莱姆随费用膨胀（`1.0x→1.38x`）并在透明肚内漂浮金色 `$` 颗粒；单次会话超 `$2.00` 自动触发搞笑“打嗝”防爆账单警报。
2. **危险命令红色警报拦截（Dangerous Command Guard）**：实时检测 Agent 工具调用中的 `rm -rf`、`git push --force`、`git reset --hard`、`DROP TABLE`、`sudo rm`，瞬间弹出红色 `⚠️ DANGER` 警报，点击气泡直达对应终端/IDE。
3. **透明果冻肚皮 3 槽位暂存胶囊**：最多吞入 3 条报错日志、代码或剪贴板片段（肚内实时可见悬浮小胶囊），随时一键“吐”回系统剪贴板。
4. **代码语言染色吸收 + Commit 进化解锁**：编辑 `.rs` / `.py` / `.ts` / `.go` 文件时果冻实时混合语言光学色泽；完成任务与提交累计本地 XP（`Lv.1→Lv.5`），自动解锁小草芽 → 墨镜 → 耳机 → 巫师帽 → 小皇冠。
5. **一键导出“本周史莱姆编程战报卡 PNG”**：纯代码合成 `800×420` 暗黑玻璃战报图，展示当前史莱姆造型、等级、消耗 Token、主力语言与 Slime DNA，发 X / Discord / 朋友圈自带传播力。
6. **贴壁拍扁 & 重力滑落物理 + 多终端分裂**：甩向屏幕左右边缘会“啪叽”粘在墙上缓缓滑落；同时开多个 AI 终端时分裂出带项目标签的迷你史莱姆。

## ⚡ 3 秒免安装在线试玩
直接用浏览器打开项目内的 `preview.html`（推送到 GitHub 后内置的 `.github/workflows/pages.yml` 也会自动发布 GitHub Pages 在线试玩页），即可体验戳凹陷、甩墙滑落、烧 Token 变胖打嗝、多终端分裂与战报 PNG 导出。

## 🚀 快速上手
```bash
# 1. 一键环境与 2026 主流 AI Agent 体检
npm run doctor

# 2. 运行全部三套自动化功能与代码审计测试
npm test && npm run test:v2 && npm run test:v3

# 3. 本地运行 Tauri 2 桌面端
npm install
npm run tauri dev
```

## 📦 自动化三端发版
仓库已内置 `.github/workflows/ci.yml`、`.github/workflows/release.yml` 与 `.github/workflows/pages.yml`。推送 `v*` 标签（如 `git tag v6.0.0 && git push --tags`）即可自动构建 macOS Universal（`.dmg`）、Windows（`.exe`）和 Linux（`.AppImage`）安装包。

## 🔒 隐私承诺
全局打字波纹在 Rust 层严格丢弃键码（`EventType::KeyPress(_)`），零遥测、零云端账号，100% 本地优先。

[English README](./README.md) · MIT License

## 🫧 v6.0 活体光学果冻全新亮点
- **光学取色器**：实时吸取颜色变成自身果冻光学色泽并复制 `#HEX`。
- **物理扯断分裂再融合**：拉出液桥啪地扯成两只，松手后小果冻蹦跳回来“咕噜”融回本体。
- **肚皮胶囊直点吐出**：直接点击透明肚子里漂浮的任意一颗胶囊，精准吐回剪贴板。
- **会议/录屏自动融化隐身**：复用 `sysinfo` 检测 Zoom / OBS / Teams / Loom / ScreenStudio，自动融化成底边水洼防社死。
- **深夜荧光水母模式 + 连续 3 次报错创可贴共情 + 本地堆栈 3 行 Prompt 压缩器 + 声波共振水波纹**。
