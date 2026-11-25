export interface BellyItem {
  id: string;
  label: string;
  content: string;
  kind: "text" | "log" | "code";
  swallowedAt: number;
}

/**
 * Innovation 2: Translucent Belly Shelf (Living Yoink / Dropover inside the slime!)
 * Swallows up to 3 snippets/logs/files into the translucent jelly belly where they
 * visually float until you click to "spit" them straight back onto your clipboard.
 */
export class SlimeBellyShelf {
  private readonly maxItems = 3;
  private items: BellyItem[] = [];

  constructor(initial: BellyItem[] = []) {
    this.items = initial.slice(0, this.maxItems);
  }

  public swallow(label: string, content: string, kind: BellyItem["kind"] = "text", now = Date.now()): BellyItem {
    const item: BellyItem = {
      id: `belly_${now}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim().slice(0, 18) || "snippet",
      content,
      kind,
      swallowedAt: now,
    };
    if (this.items.length >= this.maxItems) {
      this.items.shift(); // FIFO: oldest item gently popped out
    }
    this.items.push(item);
    return item;
  }

  /** Spits out the most recent (or specified) swallowed item so the user can paste it. */
  public spitOut(id?: string): BellyItem | null {
    if (this.items.length === 0) return null;
    if (!id) return this.items.pop() ?? null;
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }

  public list(): BellyItem[] {
    return this.items.map((x) => ({ ...x }));
  }

  public clear(): void {
    this.items = [];
  }
}
