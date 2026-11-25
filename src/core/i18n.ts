export type SupportedLocale = "en" | "zh" | "ja";
export type LocaleSetting = "auto" | SupportedLocale;

export interface LocaleStrings {
  menuSwallow: string;
  menuEyedropper: string;
  menuCompress: string;
  menuSplit: string;
  menuFling: string;
  menuBass: string;
  menuNight: string;
  menuCard: string;
  menuSettings: string;
  onboard1: string;
  onboard2: string;
  onboard3: string;
  lockedHint: string;
  clipboardEmpty: string;
  mcpCopied: string;
}

const DICT: Record<SupportedLocale, LocaleStrings> = {
  en: {
    menuSwallow: "🫧 Swallow Clipboard (Click belly to spit)",
    menuEyedropper: "🎨 Optical Color Eyedropper (#HEX)",
    menuCompress: "🗜️ Error Log → 3-Line Prompt",
    menuSplit: "🫧 Tear-Apart Split & Re-Merge",
    menuFling: "🧱 Fling to Wall-Stick",
    menuBass: "🎵 Toggle Bass Ripple",
    menuNight: "🌙 Toggle Night Jellyfish",
    menuCard: "📸 Export Weekly Card PNG",
    menuSettings: "⚙️ Settings, Agents & Slime DNA...",
    onboard1: "Hi! Sweep your cursor across me to poke the 3D jelly~",
    onboard2: "Right-click me for Eyedropper, Belly Shelf & Card PNG!",
    onboard3: "Open Settings to connect Claude Code, Codex or Cursor in 1 click.",
    lockedHint: "Position locked (unlock in Settings to drag)",
    clipboardEmpty: "Clipboard is empty!",
    mcpCopied: "MCP JSON copied! Paste into Cursor / OpenCode / Gemini CLI.",
  },
  zh: {
    menuSwallow: "🫧 吞入剪贴板（点肚皮吐出）",
    menuEyedropper: "🎨 光学屏幕取色（复制 #HEX）",
    menuCompress: "🗜️ 报错日志 → 3行精简 Prompt",
    menuSplit: "🫧 物理扯断分裂 & 融合",
    menuFling: "🧱 甩向边缘贴墙滑落",
    menuBass: "🎵 开启/关闭声波共振",
    menuNight: "🌙 切换深夜荧光水母",
    menuCard: "📸 导出本周史莱姆战报 PNG",
    menuSettings: "⚙️ 设置、多 Agent 接入与 Slime DNA...",
    onboard1: "嗨！把鼠标划过我，试试 3D 果冻凹陷手感~",
    onboard2: "右键可以屏幕取色、吞入剪贴板胶囊或导出战报卡！",
    onboard3: "打开设置可一键接入 Claude Code / Codex / Cursor。",
    lockedHint: "已锁定桌面位置（可在设置中解锁拖动）",
    clipboardEmpty: "剪贴板是空的，先复制一段内容吧！",
    mcpCopied: "已复制 MCP 配置 JSON！可直接贴进 Cursor / OpenCode / Gemini CLI。",
  },
  ja: {
    menuSwallow: "🫧 クリップボードを飲み込む（クリックで排出）",
    menuEyedropper: "🎨 光学スポイト（#HEXコピー）",
    menuCompress: "🗜️ エラーログ → 3行プロンプト圧縮",
    menuSplit: "🫧 ぷるぷる分裂＆合体",
    menuFling: "🧱 壁にペタッと貼り付け",
    menuBass: "🎵 バス音波リップル切替",
    menuNight: "🌙 深夜クラゲ発光モード",
    menuCard: "📸 週間スライム戦績PNGを保存",
    menuSettings: "⚙️ 設定・AI連携・Slime DNA...",
    onboard1: "こんにちは！カーソルでなでて3Dゼリーをぷにぷにしてみて〜",
    onboard2: "右クリックでスポイト・お腹クリップ・戦績カードが使えます！",
    onboard3: "設定から Claude Code / Codex / Cursor をワンクリック連携できます。",
    lockedHint: "位置ロック中（設定から解除できます）",
    clipboardEmpty: "クリップボードが空です！",
    mcpCopied: "MCP JSONをコピーしました！Cursor / OpenCode / Gemini CLI に貼り付けてください。",
  },
};

export function resolveLocale(setting: LocaleSetting = "auto", navLang?: string): SupportedLocale {
  if (setting !== "auto" && setting in DICT) return setting;
  const raw = (navLang ?? (typeof navigator !== "undefined" ? navigator.language : "en")).toLowerCase();
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  return "en";
}

export function getStrings(setting: LocaleSetting = "auto", navLang?: string): LocaleStrings {
  return DICT[resolveLocale(setting, navLang)];
}

export const MCP_SNIPPET_JSON = JSON.stringify(
  {
    mcpServers: {
      slimepulse: {
        command: "node",
        args: ["/ABSOLUTE/PATH/TO/slimepulse/mcp-server/index.mjs"],
      },
    },
  },
  null,
  2
);
