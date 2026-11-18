// audio.js - Tiny WebAudio synth: engine hum, sirens, punches, shots, cash.
// No audio files; everything is oscillators/noise so the game works offline.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.noteIndex = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.32, this.ctx.currentTime);
    }
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise(duration, volume) {
    if (!this.ensure()) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume || 0.2;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  playPunch() { this.noise(0.08, 0.25); this.tone(120, 0.09, "sine", 0.3, 55); }
  playShot() { this.noise(0.11, 0.32); this.tone(720, 0.08, "sawtooth", 0.16, 120); }
  playExplosion() { this.noise(0.55, 0.5); this.tone(90, 0.5, "sine", 0.5, 30); }
  playCash() { this.tone(880, 0.1, "triangle", 0.25); setTimeout(() => this.tone(1320, 0.16, "triangle", 0.25), 70); }
  playEnterCar() { this.tone(220, 0.09, "triangle", 0.2, 330); }
  playHurt() { this.tone(160, 0.14, "sawtooth", 0.22, 80); }

  startMusic() {
    if (this.musicTimer || !this.ensure()) return;
    const bassline = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const freq = bassline[this.noteIndex % bassline.length];
      this.noteIndex += 1;
      this.tone(freq, 0.34, "triangle", 0.13);
      if (this.noteIndex % 2 === 0) this.tone(freq * 4, 0.12, "sine", 0.05);
    }, 360);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  setSiren(active) {
    if (!this.ensure()) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = "triangle";
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = false;
      this.sirenTimer = setInterval(() => {
        if (this.sirenOsc) this.sirenOsc.frequency.value = high ? 950 : 650;
        high = !high;
      }, 420);
    } else if (!active && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }
}
