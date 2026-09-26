/** All sounds are synthesized with the Web Audio API — no audio files. */
class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Must be called from a user gesture before audio can play. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; endFreq?: number; attack?: number } = {},
  ) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + duration);
    const peak = opts.gain ?? 0.2;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(start: number, duration: number, gain: number, filterFreq: number) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  laser() {
    this.tone(1400, 0, 0.12, { type: 'square', endFreq: 220, gain: 0.08 });
  }

  chime() {
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) =>
      this.tone(f, i * 0.07, 0.35, { type: 'triangle', gain: 0.22 }),
    );
    this.noise(0, 0.25, 0.15, 1800);
  }

  buzz() {
    this.tone(110, 0, 0.45, { type: 'sawtooth', gain: 0.2, endFreq: 70 });
    this.tone(116, 0, 0.45, { type: 'square', gain: 0.08, endFreq: 72 });
  }

  impact() {
    this.noise(0, 0.5, 0.5, 600);
    this.tone(90, 0, 0.4, { type: 'sine', gain: 0.35, endFreq: 40 });
  }

  /** Free aim: a short two-note blip when SPACE arms the aimed cell. */
  arm() {
    this.tone(880, 0, 0.06, { type: 'square', gain: 0.07 });
    this.tone(1320, 0.07, 0.08, { type: 'square', gain: 0.07 });
  }

  denied() {
    this.tone(180, 0, 0.12, { type: 'square', gain: 0.1 });
    this.tone(140, 0.13, 0.18, { type: 'square', gain: 0.1 });
  }

  fanfare() {
    const notes: [number, number, number][] = [
      [523.25, 0, 0.18],
      [659.25, 0.18, 0.18],
      [783.99, 0.36, 0.18],
      [1046.5, 0.54, 0.7],
    ];
    notes.forEach(([f, s, d]) => {
      this.tone(f, s, d, { type: 'square', gain: 0.12 });
      this.tone(f / 2, s, d, { type: 'triangle', gain: 0.15 });
    });
    [1318.5, 1567.98].forEach((f) => this.tone(f, 0.54, 0.9, { type: 'triangle', gain: 0.07, attack: 0.05 }));
  }

  clunk() {
    this.noise(0, 0.35, 0.6, 400);
    this.tone(70, 0, 0.5, { type: 'sine', gain: 0.5, endFreq: 35 });
    this.tone(220, 0.25, 0.15, { type: 'square', gain: 0.08, endFreq: 180 });
    this.tone(880, 0.45, 0.6, { type: 'triangle', gain: 0.12 });
  }
}

export const sound = new SoundBoard();
