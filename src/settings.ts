import { getStrings, MCP_SNIPPET_JSON, type LocaleSetting } from "./core/i18n.ts";
import { DEFAULT_CONFIG, type AppConfig, type SlimeAccessory, type SlimeDNA, type SlimeFlavor } from "./core/types.ts";
import { invokeSafe, writeClipboardText } from "./bridge/tauriBridge.ts";

const CONFIG_KEY = "slimepulse_config_v20";

function loadConfig(): AppConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      dna: { ...DEFAULT_CONFIG.dna, ...(parsed.dna || {}) },
    };
  } catch {
    return { ...DEFAULT_CONFIG, dna: { ...DEFAULT_CONFIG.dna } };
  }
}

function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

async function initSettings(): Promise<void> {
  const cfg = loadConfig();

  const localeSel = document.getElementById("locale-select") as HTMLSelectElement;
  const scaleSel = document.getElementById("scale-select") as HTMLSelectElement;
  const lockChk = document.getElementById("lock-position") as HTMLInputElement;
  const ecoChk = document.getElementById("eco-mode") as HTMLInputElement;
  const agentListEl = document.getElementById("agent-list") as HTMLDivElement;

  const flavorSel = document.getElementById("flavor-select") as HTMLSelectElement;
  const accSel = document.getElementById("accessory-select") as HTMLSelectElement;
  const transInput = document.getElementById("translucency-range") as HTMLInputElement;
  const bubbleInput = document.getElementById("bubble-range") as HTMLInputElement;
  const dnaBox = document.getElementById("dna-json") as HTMLTextAreaElement;
  const loadInput = document.getElementById("load-threshold") as HTMLInputElement;
  const budgetInput = document.getElementById("budget-alert-usd") as HTMLInputElement;
  const pomoInput = document.getElementById("pomo-minutes") as HTMLInputElement;
  const stealthChk = document.getElementById("meeting-stealth-enabled") as HTMLInputElement;
  const nightChk = document.getElementById("night-glow-enabled") as HTMLInputElement;
  const soundChk = document.getElementById("sound-enabled") as HTMLInputElement;
  const rippleChk = document.getElementById("ripple-enabled") as HTMLInputElement;
  const providerSel = document.getElementById("ai-provider") as HTMLSelectElement;
  const endpointInput = document.getElementById("ai-endpoint") as HTMLInputElement;
  const modelInput = document.getElementById("ai-model") as HTMLInputElement;
  const keyInput = document.getElementById("ai-key") as HTMLInputElement;
  const statusEl = document.getElementById("hook-status") as HTMLSpanElement;

  const syncDnaBox = () => {
    const dna: SlimeDNA = {
      version: 1,
      flavor: flavorSel.value as SlimeFlavor,
      accessory: accSel.value as SlimeAccessory,
      translucency: Number(transInput.value),
      bubbleDensity: Number(bubbleInput.value),
    };
    dnaBox.value = JSON.stringify(dna, null, 2);
  };

  localeSel.value = cfg.locale;
  scaleSel.value = String(cfg.petScale);
  lockChk.checked = cfg.lockPosition;
  ecoChk.checked = cfg.ecoMode;
  flavorSel.value = cfg.dna.flavor;
  accSel.value = cfg.dna.accessory;
  transInput.value = String(cfg.dna.translucency);
  bubbleInput.value = String(cfg.dna.bubbleDensity);
  loadInput.value = String(cfg.highLoadThreshold);
  budgetInput.value = String(cfg.budgetAlertUsd);
  pomoInput.value = String(cfg.pomodoroMinutes);
  stealthChk.checked = cfg.autoMeetingStealth;
  nightChk.checked = cfg.autoNightGlow;
  soundChk.checked = cfg.enableSoundEffects;
  rippleChk.checked = cfg.enableTypingRipples;
  providerSel.value = cfg.aiProvider;
  endpointInput.value = cfg.aiEndpoint;
  modelInput.value = cfg.aiModel;
  keyInput.value = cfg.aiApiKey;
  syncDnaBox();

  // Populate live 2026 Multi-Agent Detection badges
  const detected = await invokeSafe<Array<{ name: string; detected: boolean; configHint: string }>>("detect_installed_agents");
  const agents = detected ?? [
    { name: "Claude Code", detected: false, configHint: "Hooks + Log Watcher" },
    { name: "OpenAI Codex CLI", detected: false, configHint: "Auto Log Watcher" },
    { name: "OpenCode", detected: false, configHint: "Log Watcher + MCP" },
    { name: "Gemini CLI", detected: false, configHint: "MCP Server" },
    { name: "Cursor", detected: false, configHint: "MCP Server" },
  ];
  agentListEl.innerHTML = "";
  for (const a of agents) {
    const pill = document.createElement("span");
    pill.className = a.detected ? "badge ok" : "badge";
    pill.textContent = `${a.detected ? "✓" : "•"} ${a.name}`;
    pill.title = a.configHint;
    agentListEl.appendChild(pill);
  }

  [flavorSel, accSel, transInput, bubbleInput].forEach((el) => el.addEventListener("input", syncDnaBox));


  const installMcpAgent = async (agent: "cursor" | "gemini") => {
    const res = await invokeSafe<string>("install_mcp_for_agent", {
      agent,
      mcpScriptPath: "slimepulse/mcp-server/index.mjs",
    });
    const toast = document.getElementById("save-toast");
    if (toast) {
      toast.textContent = res ? `Configured ${agent} at ${res}` : `Run desktop app to auto-write ${agent} MCP config.`;
      setTimeout(() => (toast.textContent = ""), 3000);
    }
  };
  document.getElementById("btn-install-cursor")?.addEventListener("click", () => void installMcpAgent("cursor"));
  document.getElementById("btn-install-gemini")?.addEventListener("click", () => void installMcpAgent("gemini"));

  document.getElementById("btn-copy-mcp")?.addEventListener("click", async () => {
    const ok = await writeClipboardText(MCP_SNIPPET_JSON);
    const toast = document.getElementById("save-toast");
    const i18n = getStrings(localeSel.value as LocaleSetting);
    if (toast) {
      toast.textContent = ok ? i18n.mcpCopied : "Copy failed.";
      setTimeout(() => (toast.textContent = ""), 3000);
    }
  });

  document.getElementById("btn-copy-dna")?.addEventListener("click", async () => {
    const ok = await writeClipboardText(dnaBox.value);
    const toast = document.getElementById("save-toast");
    if (toast) {
      toast.textContent = ok ? "Slime DNA copied to clipboard!" : "Copy failed — select text manually.";
      setTimeout(() => (toast.textContent = ""), 2200);
    }
  });

  document.getElementById("btn-import-dna")?.addEventListener("click", () => {
    try {
      const imported = JSON.parse(dnaBox.value) as Partial<SlimeDNA>;
      if (imported.flavor) flavorSel.value = imported.flavor;
      if (imported.accessory) accSel.value = imported.accessory;
      if (typeof imported.translucency === "number") transInput.value = String(imported.translucency);
      if (typeof imported.bubbleDensity === "number") bubbleInput.value = String(imported.bubbleDensity);
      syncDnaBox();
    } catch {
      const toast = document.getElementById("save-toast");
      if (toast) toast.textContent = "Invalid Slime DNA JSON!";
    }
  });

  const installed = await invokeSafe<boolean>("check_claude_code_hooks");
  statusEl.textContent = installed ? "Connected (~/.claude/settings.json)" : "Not configured";
  statusEl.className = installed ? "badge ok" : "badge";

  document.getElementById("btn-save")?.addEventListener("click", () => {
    const next: AppConfig = {
      ...cfg,
      locale: localeSel.value as LocaleSetting,
      petScale: Number(scaleSel.value) || 1.0,
      lockPosition: lockChk.checked,
      ecoMode: ecoChk.checked,
      dna: {
        version: 1,
        flavor: flavorSel.value as SlimeFlavor,
        accessory: accSel.value as SlimeAccessory,
        translucency: Number(transInput.value),
        bubbleDensity: Number(bubbleInput.value),
      },
      highLoadThreshold: Number(loadInput.value) || 75,
      budgetAlertUsd: Math.max(0.1, Number(budgetInput.value) || 2.0),
      pomodoroMinutes: Number(pomoInput.value) || 45,
      autoMeetingStealth: stealthChk.checked,
      autoNightGlow: nightChk.checked,
      enableSoundEffects: soundChk.checked,
      enableTypingRipples: rippleChk.checked,
      aiProvider: providerSel.value as AppConfig["aiProvider"],
      aiEndpoint: endpointInput.value.trim(),
      aiModel: modelInput.value.trim(),
      aiApiKey: keyInput.value.trim(),
    };
    saveConfig(next);
    const toast = document.getElementById("save-toast");
    if (toast) {
      toast.textContent = "Saved!";
      setTimeout(() => (toast.textContent = ""), 2000);
    }
  });

  document.getElementById("btn-install-hooks")?.addEventListener("click", async () => {
    const res = await invokeSafe<{ settingsPath: string }>("install_claude_code_hooks", {
      port: cfg.webhookPort,
    });
    if (res) {
      statusEl.textContent = `Installed at ${res.settingsPath}`;
      statusEl.className = "badge ok";
    }
  });

  document.getElementById("btn-uninstall-hooks")?.addEventListener("click", async () => {
    await invokeSafe("uninstall_claude_code_hooks");
    statusEl.textContent = "Removed";
    statusEl.className = "badge";
  });
}

void initSettings();
