/**
 * Procedural Web Audio synthesizer for SlimePulse v4.1.
 * Zero external audio files — synthesizes squishy jelly boings, gulp, spit pop,
 * humorous burp bubbles, wall-splat thud, and gentle ambient bubbling/rain.
 */
export class SlimeAudioEngine {
  private ctx: AudioContext | null = null;
  private ambientNode: AudioScheduledSourceNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientLfoGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientMode: "off" | "purr" | "rain" = "off";

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(f0: number, f1: number, dur: number, gainPeak = 0.16, type: OscillatorType = "sine", delay = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur * 0.65);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Bouncy squishy jelly "boing-bloop!" chime (double-boing when urgent approval). */
  public playSquish(urgent = false): void {
    this.playTone(urgent ? 380 : 320, urgent ? 880 : 690, 0.24, 0.17, "sine", 0);
    if (urgent) {
      this.playTone(460, 1020, 0.24, 0.17, "sine", 0.14);
    }
  }

  /** Downward-upward liquid "gloop!" when swallowing a snippet into the translucent belly. */
  public playGulp(): void {
    this.playTone(540, 210, 0.14, 0.15, "sine", 0);
    this.playTone(230, 460, 0.12, 0.13, "sine", 0.09);
  }

  /** Crisp upward "pop!" when spitting a capsule back to the clipboard. */
  public playSpit(): void {
    this.playTone(280, 920, 0.13, 0.16, "triangle", 0);
  }

  /** Humorous bubbly "burp!" when session AI spend crosses the budget threshold. */
  public playBurp(): void {
    this.playTone(170, 95, 0.22, 0.18, "sawtooth", 0);
    this.playTone(340, 620, 0.11, 0.11, "sine", 0.16);
    this.playTone(420, 780, 0.10, 0.10, "sine", 0.24);
  }

  /** Soft wet "splat!" when flung against the left/right screen edge. */
  public playSplat(): void {
    this.playTone(220, 82, 0.16, 0.18, "triangle", 0);
  }

  public setAmbient(mode: "off" | "purr" | "rain"): void {
    if (this.ambientMode === mode) return;
    this.stopAmbient();
    this.ambientMode = mode;
    if (mode === "off") return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(mode === "purr" ? 0.08 : 0.05, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.ambientGain = masterGain;

    if (mode === "purr") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(92, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(1.8, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      osc.connect(masterGain);

      osc.start();
      lfo.start();
      this.ambientNode = osc;
      this.ambientLfo = lfo;
      this.ambientLfoGain = lfoGain;
    } else if (mode === "rain") {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.04) * 0.8;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1100, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start();
      this.ambientNode = noise;
    }
  }

  public stopAmbient(): void {
    if (this.ambientNode) {
      try {
        this.ambientNode.stop();
      } catch {
        // Ignore
      }
      this.ambientNode.disconnect();
      this.ambientNode = null;
    }
    if (this.ambientLfo) {
      try {
        this.ambientLfo.stop();
      } catch {
        // Ignore
      }
      this.ambientLfo.disconnect();
      this.ambientLfo = null;
    }
    if (this.ambientLfoGain) {
      this.ambientLfoGain.disconnect();
      this.ambientLfoGain = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
    this.ambientMode = "off";
  }
}
