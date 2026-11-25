import type {
  AgentEventPayload,
  HardwareMetrics,
  LocalCursorPos,
  PawTapEvent,
} from "../core/types.ts";

export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriEnv()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauriEnv()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

export async function readClipboardText(): Promise<string> {
  if (isTauriEnv()) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return (await readText()) ?? "";
  }
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return "";
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (isTauriEnv()) {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function subscribeTauriEvents(handlers: {
  onAgentEvent: (payload: AgentEventPayload) => void;
  onHardware: (metrics: HardwareMetrics) => void;
  onPawTap: (tap: PawTapEvent) => void;
  onCursorPos: (pos: LocalCursorPos) => void;
  onToggleMute?: () => void;
  onNativeFolderDrop?: (paths: string[]) => void;
}): Promise<void> {
  if (!isTauriEnv()) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<AgentEventPayload>("slimepulse://agent-event", (e) => handlers.onAgentEvent(e.payload));
  await listen<HardwareMetrics>("slimepulse://hardware-metrics", (e) => handlers.onHardware(e.payload));
  await listen<PawTapEvent>("slimepulse://paw-tap", (e) => handlers.onPawTap(e.payload));
  await listen<LocalCursorPos>("slimepulse://cursor-pos", (e) => handlers.onCursorPos(e.payload));
  if (handlers.onToggleMute) await listen("slimepulse://toggle-mute", () => handlers.onToggleMute?.());

  if (handlers.onNativeFolderDrop) {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths.length > 0) {
        handlers.onNativeFolderDrop?.(event.payload.paths);
      }
    });
  }
}
