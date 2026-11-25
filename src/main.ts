import { analyzeClipboardSnippet, compressErrorToPrompt } from "./core/aiCompanion.ts";
import { SlimeAudioEngine } from "./core/audioEngine.ts";
import { SlimeBellyShelf, type BellyItem } from "./core/bellyShelf.ts";
import { downloadSlimeCardPng } from "./core/cardExporter.ts";
import { LANGUAGE_TINTS, SlimeEvolutionEngine } from "./core/evolution.ts";
import { buildSlimeCursorCss, SlimeLivingSoul } from "./core/livingSoul.ts";
import { SLIME_PALETTES } from "./core/slimeEngine.ts";
import { getStrings } from "./core/i18n.ts";
import { PomodoroGuard } from "./core/pomodoro.ts";
import { SlimeRenderer } from "./core/renderer.ts";
import { PetStateMachine } from "./core/stateMachine.ts";
import { TokenStomachTracker } from "./core/tokenTracker.ts";
import { DEFAULT_CONFIG, type AppConfig } from "./core/types.ts";
import {
  invokeSafe,
  isTauriEnv,
  readClipboardText,
  startWindowDrag,
  subscribeTauriEvents,
  writeClipboardText,
} from "./bridge/tauriBridge.ts";

export const CONFIG_KEY = "slimepulse_config_v20";
const TOKEN_KEY = "slimepulse_tokens_v20";
const BELLY_KEY = "slimepulse_belly_v20";
const EVO_KEY = "slimepulse_evo_v20";
const ONBOARD_KEY = "slimepulse_onboard_v52";

function loadObject<T extends Record<string, unknown>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...parsed } as T;
  } catch {
    return fallback;
  }
}

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function loadConfig(): AppConfig {
  const parsed = loadObject<Partial<AppConfig>>(CONFIG_KEY, {});
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    dna: { ...DEFAULT_CONFIG.dna, ...(parsed.dna || {}) },
  };
}

function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function isLateNightNow(): boolean {
  const hr = new Date().getHours();
  return hr >= 23 || hr < 6;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  return [
    parseInt(clean.slice(0, 2), 16) || 34,
    parseInt(clean.slice(2, 4), 16) || 197,
    parseInt(clean.slice(4, 6), 16) || 94,
  ];
}

async function bootstrap(): Promise<void> {
  const stageEl = document.getElementById("pet-stage") as HTMLDivElement;
  const canvas = document.getElementById("pet-canvas") as HTMLCanvasElement;
  const bubbleEl = document.getElementById("speech-bubble") as HTMLDivElement;
  const loadBadgeEl = document.getElementById("load-badge") as HTMLDivElement;
  const menuEl = document.getElementById("context-menu") as HTMLDivElement;

  const config = loadConfig();
  const fsm = new PetStateMachine(config.highLoadThreshold);
  const renderer = new SlimeRenderer(canvas);
  const audio = new SlimeAudioEngine();
  const pomodoro = new PomodoroGuard(config.pomodoroMinutes);

  const tokenTracker = new TokenStomachTracker(config.budgetAlertUsd, loadObject(TOKEN_KEY, {}));
  const bellyShelf = new SlimeBellyShelf(loadArray<BellyItem>(BELLY_KEY));
  const evolution = new SlimeEvolutionEngine(loadObject(EVO_KEY, {}));
  const soul = new SlimeLivingSoul();
  let prevErrorsBeforeDone = 0;

  let meetingStealthActive = false;
  let manualNightGlow: boolean | null = null;
  let absorbedColor: [number, number, number] | null = null;
  let bassEnabled = false;
  const fallbackSwatches = ["#F43F5E", "#8B5CF6", "#F59E0B", "#06B6D4"];
  let swatchIdx = 0;

  const syncV2Overlay = (bassLevel = 0) => {
    const evoSnap = evolution.getSnapshot();
    const tokSnap = tokenTracker.getSnapshot();
    const nightGlow = manualNightGlow !== null ? manualNightGlow : (config.autoNightGlow && isLateNightNow());
    renderer.setV2Overlay({
      fatnessScale: tokenTracker.getFatnessScale(),
      goldenOrbs: tokenTracker.getGoldenOrbCount(),
      bellyItems: bellyShelf.list(),
      languageTint: LANGUAGE_TINTS[evoSnap.activeLanguage],
      absorbedColor,
      meetingStealth: config.autoMeetingStealth && meetingStealthActive,
      nightGlow,
      quotaSweating: tokSnap.quotaPercent >= 85,
      bassLevel,
    });
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokSnap));
    localStorage.setItem(BELLY_KEY, JSON.stringify(bellyShelf.list()));
    localStorage.setItem(EVO_KEY, JSON.stringify(evoSnap));
  };

  renderer.setDNA(config.dna);
  renderer.enableTypingRipples = config.enableTypingRipples;
  syncV2Overlay();

  const applyUsabilityPrefs = () => {
    const tr = getStrings(config.locale);
    const map: Record<string, string> = {
      "swallow-belly": tr.menuSwallow,
      "eyedropper": tr.menuEyedropper,
      "compress-prompt": tr.menuCompress,
      "split-merge": tr.menuSplit,
      "fling-wall": tr.menuFling,
      "toggle-bass": tr.menuBass,
      "night-glow": tr.menuNight,
      "export-card": tr.menuCard,
      "open-settings": tr.menuSettings,
    };
    menuEl.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((b) => {
      const k = b.dataset.action;
      if (k && map[k]) b.textContent = map[k];
    });
    const sc = Math.max(0.75, Math.min(1.25, config.petScale || 1.0));
    stageEl.style.transform = `scale(${sc})`;
    stageEl.style.transformOrigin = "bottom center";
  };

  applyUsabilityPrefs();

  // 15-second zero-popup first-run onboarding bubbles (runs once ever)
  if (!localStorage.getItem(ONBOARD_KEY)) {
    const tr = getStrings(config.locale);
    fsm.showBubble(tr.onboard1, 4500);
    window.setTimeout(() => fsm.showBubble(tr.onboard2, 4800), 4800);
    window.setTimeout(() => {
      fsm.showBubble(tr.onboard3, 5200);
      localStorage.setItem(ONBOARD_KEY, "1");
    }, 9900);
  }


  // Auto-refresh late-night bioluminescent mode every minute even when idle
  window.setInterval(() => syncV2Overlay(), 60_000);

  let lastClickThrough = false;
  let lastCursorX = -999;
  let cursorCoatedActive = false;
  let lastNotifiedState = "";

  bubbleEl.addEventListener("click", () => {
    const approved = fsm.dismissApproval();
    if (approved || bubbleEl.classList.contains("urgent")) {
      void invokeSafe("focus_terminal_window", { hint: approved?.projectName ?? "terminal" });
    }
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void invokeSafe("toggle_zen_hide");
    }
  });

  await subscribeTauriEvents({
    onAgentEvent: (payload) => {
      let burpAlert: string | null = null;
      if ((payload.tokensUsed && payload.tokensUsed > 0) || (payload.costUsd && payload.costUsd > 0)) {
        const res = tokenTracker.recordUsage(
          payload.tokensUsed ?? 0,
          payload.costUsd ?? 0,
          payload.source ?? "claude-code"
        );
        burpAlert = res.burpAlert;
      }

      if (payload.filePath) {
        evolution.detectLanguageFromPath(payload.filePath);
      }

      const priorSnap = fsm.tick(Date.now());
      prevErrorsBeforeDone = priorSnap.consecutiveErrors;
      const st = fsm.handleAgentEvent(payload);
      const snap = fsm.tick(Date.now());

      if (st === "TASK_DONE") {
        const memMsg = soul.reactToBuildSuccess(prevErrorsBeforeDone);
        if (memMsg) fsm.showBubble(memMsg, 6000);
        const isCommit = /commit|push|pr/i.test(payload.label ?? "");
        const xpRes = evolution.awardXp(isCommit ? 40 : 15, isCommit);
        if (xpRes.leveledUp && xpRes.unlocked) {
          config.dna.accessory = xpRes.unlocked;
          saveConfig(config);
          renderer.setDNA(config.dna);
          fsm.showBubble(`Lv.${xpRes.newLevel}! Unlocked ${xpRes.unlocked}!`, 6500);
        }
      } else if (st === "TASK_ERROR" && snap.empathyMode) {
        fsm.showBubble("3 fails in a row — breathe, we'll fix it together ♥", 6000);
      }

      if (burpAlert) {
        renderer.triggerBurp();
        fsm.showBubble(burpAlert, 7500);
        if (config.enableSoundEffects) audio.playBurp();
      } else if (config.enableSoundEffects && (st === "TASK_DONE" || st === "NEED_APPROVAL")) {
        if (st !== lastNotifiedState) {
          audio.playSquish(st === "NEED_APPROVAL");
        }
      }

      syncV2Overlay();
      lastNotifiedState = st;
    },
    onHardware: (metrics) => {
      fsm.updateHardware(metrics);
      const nextStealth = Boolean(metrics.meetingStealth);
      if (nextStealth !== meetingStealthActive) {
        meetingStealthActive = nextStealth;
        syncV2Overlay();
      }
      const gpuText = metrics.gpuPercent !== null ? ` · GPU ${Math.round(metrics.gpuPercent)}%` : "";
      const evo = evolution.getSnapshot();
      loadBadgeEl.textContent = `CPU ${Math.round(metrics.cpuPercent)}%${gpuText} · Lv.${evo.level} · ${tokenTracker.formatAgentBreakdown()}`;
    },
    onPawTap: (tap) => {
      fsm.handlePawTap(tap.paw);
      pomodoro.recordActivity();
      renderer.spawnTypingRipple(tap.paw);
    },
    onToggleMute: () => {
      config.enableSoundEffects = !config.enableSoundEffects;
      saveConfig(config);
      fsm.showBubble(config.enableSoundEffects ? "Sound Effects ON" : "Sound Effects MUTED", 2400);
    },
    onCursorPos: (pos) => {
      renderer.setCursorLook(pos.x, pos.y);
      if (lastCursorX > -500 && renderer.isPointOnSlime(pos.x, pos.y)) {
        const dx = pos.x - lastCursorX;
        soul.recordCursorSwipe(dx, Math.abs(dx));
      }
      lastCursorX = pos.x;
      const overMenu = !menuEl.classList.contains("hidden");
      const overBubble = !bubbleEl.classList.contains("hidden") && pos.y < 86;
      const shouldIgnore = pos.insideWindow && !overMenu && !overBubble && !renderer.isPointOnSlime(pos.x, pos.y);
      if (shouldIgnore !== lastClickThrough) {
        lastClickThrough = shouldIgnore;
        void invokeSafe("set_click_through", { ignore: shouldIgnore });
      }
    },
  });

  if (!isTauriEnv()) {
    let toggle = true;
    window.addEventListener("keydown", () => {
      const paw = toggle ? "left" : "right";
      toggle = !toggle;
      fsm.handlePawTap(paw);
      pomodoro.recordActivity();
      renderer.spawnTypingRipple(paw);
    });
    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      renderer.setCursorLook(e.clientX - rect.left, e.clientY - rect.top);
    });
  }

  let petHoverTimer: number | null = null;
  canvas.addEventListener("mouseenter", () => {
    loadBadgeEl.classList.remove("hidden");
    petHoverTimer = window.setTimeout(() => { fsm.setPetting(true); if (soul.forgivePout()) fsm.showBubble("Hmph... okay, forgiven ♥", 3200); }, 700);
  });
  canvas.addEventListener("mouseleave", () => {
    loadBadgeEl.classList.add("hidden");
    if (petHoverTimer !== null) clearTimeout(petHoverTimer);
    fsm.setPetting(false);
  });

  // Direct Click-to-Spit Belly Capsule before window drag
  canvas.addEventListener("mousedown", async (e) => {
    menuEl.classList.add("hidden");
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const hit = renderer.hitTestBellyCapsule(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        const item = bellyShelf.spitOut(hit.id);
        syncV2Overlay();
        if (item) {
          renderer.triggerSpit();
          const ok = await writeClipboardText(item.content);
          fsm.showBubble(ok ? `Spit "${item.label}" -> Clipboard!` : `Spit "${item.label}"`, 3200);
          if (config.enableSoundEffects) audio.playSpit();
        }
        return;
      }
      if (config.lockPosition) {
        fsm.showBubble(getStrings(config.locale).lockedHint, 2200);
        return;
      }
      fsm.setDragging(true);
      void startWindowDrag().finally(() => { fsm.setDragging(false); void invokeSafe("save_window_position"); });
    }
  });
  window.addEventListener("mouseup", () => fsm.setDragging(false));

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    menuEl.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!menuEl.contains(e.target as Node)) menuEl.classList.add("hidden");
  });

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    evolution.detectLanguageFromPath(file.name);
    const tasteMsg = soul.reactToFile(file.name);
    if (tasteMsg) fsm.showBubble(tasteMsg, 4000);
    const text = await file.text();
    bellyShelf.swallow(file.name, text, file.name.endsWith(".log") ? "log" : "code");
    syncV2Overlay();
    fsm.startDigesting(file.name, 12_000);
    fsm.handleAgentEvent({ state: "AI_THINKING", label: `Swallowed ${file.name} (${bellyShelf.list().length}/3)`, durationMs: 12_000 });
    const reply = await analyzeClipboardSnippet(text, config);
    fsm.finishDigesting();
    fsm.handleAgentEvent({ state: "TASK_DONE", label: reply, durationMs: 11_000 });
    if (config.enableSoundEffects) audio.playSquish(false);
  });

  menuEl.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    menuEl.classList.add("hidden");

    if (action === "swallow-belly") {
      const text = await readClipboardText();
      if (!text.trim()) {
        fsm.showBubble("Clipboard is empty!", 2400);
      } else {
        const item = bellyShelf.swallow(text.trim().slice(0, 14), text, "text");
        renderer.triggerGulp();
        if (config.enableSoundEffects) audio.playGulp();
        syncV2Overlay();
        fsm.showBubble(`Stored "${item.label}" — click belly to spit!`, 3200);
      }
    } else if (action === "eyedropper") {
      type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
      const ED = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
      let pickedHex: string | null = null;
      if (ED) {
        try {
          const res = await new ED().open();
          pickedHex = res.sRGBHex.toUpperCase();
        } catch {
          return; // User cancelled picker
        }
      } else {
        pickedHex = fallbackSwatches[swatchIdx++ % fallbackSwatches.length];
      }
      if (pickedHex) {
        absorbedColor = hexToRgb(pickedHex);
        renderer.triggerDyeWave(absorbedColor);
        if (config.enableSoundEffects) audio.playSquish(false);
        await writeClipboardText(pickedHex);
        syncV2Overlay();
        fsm.showBubble(`Absorbed ${pickedHex} -> Copied!`, 3400);
      }
    } else if (action === "compress-prompt") {
      const text = await readClipboardText();
      const compact = compressErrorToPrompt(text);
      await writeClipboardText(compact);
      fsm.showBubble("Compressed stacktrace -> 3-line Prompt copied!", 3800);
    } else if (action === "split-merge") {
      renderer.triggerSplit(Math.random() > 0.5 ? 1 : -1);
      fsm.showBubble("Boing! Split & re-merging...", 2600);
    } else if (action === "fling-wall") {
      renderer.flingToWall(Math.random() > 0.5 ? 240 : -240, -140);
      if (config.enableSoundEffects) audio.playSplat();
      fsm.showBubble("Splat! Sliding down...", 2600);
    } else if (action === "toggle-bass") {
      bassEnabled = !bassEnabled;
      if (!bassEnabled) renderer.setV2Overlay({ bassLevel: 0 });
      fsm.showBubble(bassEnabled ? "Bass Ripple Resonance ON!" : "Bass Ripple OFF", 2400);
    } else if (action === "night-glow") {
      manualNightGlow = manualNightGlow === true ? false : true;
      syncV2Overlay();
      fsm.showBubble(manualNightGlow ? "Bioluminescent Night Glow ON" : "Daylight Optical Jelly ON", 2600);
    } else if (action === "export-card") {
      const ok = downloadSlimeCardPng(canvas, {
        dna: config.dna,
        evolution: evolution.getSnapshot(),
        tokens: tokenTracker.getSnapshot(),
        bellyCount: bellyShelf.list().length,
      });
      fsm.showBubble(ok ? "Weekly Slime Card PNG saved!" : "Card export failed", 3200);
    } else if (action === "open-settings") {
      await invokeSafe("open_settings_window");
    }
  });

  window.addEventListener("storage", () => {
    const updated = loadConfig();
    Object.assign(config, updated);
    absorbedColor = null;
    fsm.setHighLoadThreshold(config.highLoadThreshold);
    tokenTracker.setBudgetAlertUsd(config.budgetAlertUsd);
    renderer.setDNA(config.dna);
    renderer.enableTypingRipples = config.enableTypingRipples;
    pomodoro.setLimitMinutes(config.pomodoroMinutes);
    audio.setAmbient(config.ambientSound);
    applyUsabilityPrefs();
    syncV2Overlay();
  });

  let lastRender = performance.now();
  const loop = (now: number) => {
    const snapshot = fsm.tick(Date.now());
    const minInterval = snapshot.state === "SLEEPING" ? 1000 / 20 : config.ecoMode ? 1000 / 24 : 1000 / 60;
    const dt = now - lastRender;

    if (dt >= minInterval) {
      lastRender = now;
      if (bassEnabled) {
        const beat = 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin((now / 1000) * 10.5)), 2);
        renderer.setV2Overlay({ bassLevel: beat });
      }
      const soulSnap = soul.tick(Math.min(0.033, dt / 1000), snapshot.state === "IDLE", isLateNightNow());
      renderer.setSoulSnapshot(soulSnap);
      if (soulSnap.cursorSlimed && !cursorCoatedActive) {
        cursorCoatedActive = true;
        const pal = SLIME_PALETTES[config.dna.flavor] ?? SLIME_PALETTES["classic-green"];
        const rgb = absorbedColor ?? pal.midBody;
        document.body.style.cursor = buildSlimeCursorCss(rgb);
        canvas.style.cursor = buildSlimeCursorCss(rgb);
      } else if (!soulSnap.cursorSlimed && cursorCoatedActive) {
        cursorCoatedActive = false;
        document.body.style.cursor = "auto";
        canvas.style.cursor = "pointer";
      }
      if (soulSnap.bubbleText) fsm.showBubble(soulSnap.bubbleText, 3800);
      renderer.render(snapshot, now, dt);

      const pomoMsg = pomodoro.checkReminder();
      if (pomoMsg) {
        fsm.showBubble(pomoMsg, 9000);
        if (config.enableSoundEffects) audio.playSquish(false);
      }

      if (snapshot.bubbleText) {
        bubbleEl.textContent = snapshot.needsApproval
          ? `${snapshot.bubbleText}  [Click → Terminal]`
          : snapshot.bubbleText;
        bubbleEl.classList.remove("hidden");
        bubbleEl.classList.toggle("urgent", snapshot.needsApproval);
      } else {
        bubbleEl.classList.add("hidden");
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void bootstrap();
