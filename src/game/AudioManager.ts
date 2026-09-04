const MUTE_KEY = "paperplane_muted";

/**
 * Soft floating BGM inspired by classic Nintendo Paper Plane mood
 * (original composition — not a copyrighted track).
 * Plus light bank/turn whooshes.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private phrase = 0;
  private unlocked = false;
  private muted = false;
  private playing = false;
  private intensity = 0.3;
  private lead: { osc: OscillatorNode; gain: GainNode } | null = null;
  private lastBankAt = 0;
  private lastBankDir = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      await this.ctx?.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.48;
    this.sfxGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyMuteGain();
    this.unlocked = true;
    await this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    this.applyMuteGain();
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    this.applyMuteGain();
  }

  async startMusic(intensity = 0.3): Promise<void> {
    await this.unlock();
    if (!this.ctx || !this.musicGain) return;
    this.intensity = intensity;
    if (this.playing) {
      this.setIntensity(intensity);
      return;
    }
    this.playing = true;
    this.step = 0;
    this.phrase = 0;
    this.ensureVoices();
    this.tick();
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.max(0.15, Math.min(0.55, intensity));
  }

  stopMusic(): void {
    this.playing = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.killVoices();
  }

  /** Soft paper whoosh when banking left (-1) / right (1). */
  playBank(dir: number): void {
    if (!dir) return;
    void this.unlock().then(() => {
      if (!this.ctx || !this.sfxGain || this.muted) return;
      const now = performance.now();
      if (dir === this.lastBankDir && now - this.lastBankAt < 180) return;
      this.lastBankDir = dir;
      this.lastBankAt = now;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      const startF = dir < 0 ? 720 : 640;
      const endF = dir < 0 ? 420 : 880;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(endF, t + 0.14);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.16);

      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 300;

      osc.connect(hp);
      hp.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  playCrash(): void {
    void this.unlock().then(() => {
      if (!this.ctx || !this.sfxGain || this.muted) return;
      const t = this.ctx.currentTime;
      this.beep(392, t, 0.1, 0.05);
      this.beep(294, t + 0.06, 0.12, 0.04);
      this.beep(220, t + 0.12, 0.18, 0.035);
    });
  }

  playClear(): void {
    void this.unlock().then(() => {
      if (!this.ctx || !this.sfxGain || this.muted) return;
      const notes = [523, 659, 784, 1047];
      const t0 = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        this.beep(freq, t0 + i * 0.13, 0.32, 0.05);
      });
    });
  }

  playStage(): void {
    void this.unlock().then(() => {
      if (!this.ctx || !this.sfxGain || this.muted) return;
      const t = this.ctx.currentTime;
      this.beep(587, t, 0.14, 0.04);
      this.beep(740, t + 0.11, 0.2, 0.04);
    });
  }

  playUi(): void {
    void this.unlock().then(() => {
      if (!this.ctx || !this.sfxGain || this.muted) return;
      this.beep(698, this.ctx.currentTime, 0.08, 0.03);
    });
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }

  private applyMuteGain(): void {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 1;
  }

  private ensureVoices(): void {
    if (!this.ctx || !this.musicGain || this.lead) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;
    const shelf = this.ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 1500;
    shelf.gain.value = 2.5;
    osc.connect(hp);
    hp.connect(shelf);
    shelf.connect(gain);
    gain.connect(this.musicGain);
    osc.start();
    this.lead = { osc, gain };
  }

  private killVoices(): void {
    if (!this.lead) return;
    try {
      this.lead.osc.stop();
    } catch {
      /* stopped */
    }
    this.lead = null;
  }

  private tick(): void {
    if (!this.playing || !this.ctx || !this.lead) return;

    // Soft whistle-like register — floating paper plane lullaby mood
    // D4 E4 F#4 A4 B4 D5 E5 F#5
    const scale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99];

    // Long drifting phrases (original)
    const phrases: number[][] = [
      [0, 1, 3, 4, 3, 1, 0, -1],
      [1, 3, 4, 5, 4, 3, 1, -1],
      [3, 4, 5, 7, 5, 4, 3, 1],
      [4, 3, 1, 3, 4, 5, 4, -1],
      [0, -1, 1, 3, -1, 4, 3, 1],
      [5, 4, 3, 4, 5, 7, 5, 4],
      [1, 3, 1, 0, 1, 3, 4, -1],
      [3, -1, -1, 5, 4, 3, 1, 0],
    ];

    const phrase = phrases[this.phrase % phrases.length];
    const idx = phrase[this.step % 8];
    const t = this.ctx.currentTime;
    const beat = 0.42 - this.intensity * 0.05;

    if (idx >= 0) {
      this.pluck(scale[idx], t, beat * 2.5, 0.075);
    }

    this.step += 1;
    if (this.step % 8 === 0) this.phrase += 1;
    this.timer = window.setTimeout(() => this.tick(), beat * 1000);
  }

  private pluck(freq: number, when: number, dur: number, peak: number): void {
    if (!this.lead) return;
    this.lead.osc.frequency.setValueAtTime(freq, when);
    this.lead.gain.gain.cancelScheduledValues(when);
    const cur = Math.max(0.0001, this.lead.gain.gain.value);
    this.lead.gain.gain.setValueAtTime(cur, when);
    this.lead.gain.gain.linearRampToValueAtTime(peak, when + 0.04);
    this.lead.gain.gain.linearRampToValueAtTime(peak * 0.4, when + dur * 0.5);
    this.lead.gain.gain.linearRampToValueAtTime(0.0001, when + dur);
  }

  private beep(freq: number, when: number, dur: number, vol: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
}
