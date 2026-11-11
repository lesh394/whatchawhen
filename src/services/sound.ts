// 8-Bit Web Audio API Sound Engine (Stardew Valley / Retro Indie Style)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    const saved = localStorage.getItem('whatchawhen_muted');
    this.isMuted = saved === 'true';
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('whatchawhen_muted', String(this.isMuted));
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Retro Wood Button Click
  public playClick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  // 8-bit Slider Tick
  public playTick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.025);
    } catch {}
  }

  // 8-bit Coin / Point Chime
  public playCoin() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.08);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {}
  }

  // 8-bit Hurt / Damage (taking damage in Forever mode)
  public playHurt() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.18);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  // 8-bit Blunder / Total Fail Buzzer (harsh descending retro buzz)
  public playBlunder() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Two low, harsh discordant buzzes: "BZZ-BZZT!"
      const buzzFrequencies = [150, 110];
      const times = [0, 0.16];

      buzzFrequencies.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + times[idx]);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + times[idx] + 0.14);

        gain.gain.setValueAtTime(0.15, now + times[idx]);
        gain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + times[idx]);
        osc.stop(now + times[idx] + 0.15);
      });
    } catch {}
  }

  // 8-bit Heal / Health Restored
  public playHeal() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.07, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.25);
      });
    } catch {}
  }

  // 8-bit Perfect Bullseye Jingle (Addicting mega-success chime)
  public playPerfect() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]; // C5, E5, G5, C6, E6, G6, C7
      const times = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.52];

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === notes.length - 1 ? 'sine' : 'square';
        osc.frequency.setValueAtTime(freq, now + times[idx]);

        gain.gain.setValueAtTime(0.1, now + times[idx]);
        gain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + times[idx]);
        osc.stop(now + times[idx] + 0.36);
      });
    } catch {}
  }

  // 8-bit Victory / High Score Fanfare
  public playSuccess() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]; // Stardew item fanfare
      const times = [0, 0.1, 0.2, 0.3, 0.45, 0.55];

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + times[idx]);

        gain.gain.setValueAtTime(0.08, now + times[idx]);
        gain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + times[idx]);
        osc.stop(now + times[idx] + 0.26);
      });
    } catch {}
  }
}

export const sounds = new SoundEngine();
