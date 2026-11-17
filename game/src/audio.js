// audio.js - Synthesised WebAudio sound and music for NEON BAY.
// No audio files: every sound is an oscillator / noise burst created in code.

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = 0;
    this.noteIndex = 0;
    this.started = false;
    try {
      this.muted = window.localStorage.getItem("neon-bay-muted-v1") === "1";
    } catch (err) { this.muted = false; }
  }

  ensureContext() {
    if (this.context) {
      if (this.context.state === "suspended") this.context.resume();
      return this.context;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.started = true;
    return this.context;
  }

  setMuted(muted) {
    this.muted = muted;
    try { window.localStorage.setItem("neon-bay-muted-v1", muted ? "1" : "0"); } catch (err) { void err; }
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.03);
    }
  }

  toggleMute() {
    this.ensureContext();
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone(freq, duration, type, volume, slideTo, destination) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(destination || this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  noise(duration, volume) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.2;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  playShot() { this.tone(190, 0.12, "sawtooth", 0.22, 55); this.noise(0.08, 0.16); }
  playShotQuiet() { this.tone(170, 0.09, "sawtooth", 0.07, 60); }
  playPunch() { this.noise(0.07, 0.2); this.tone(95, 0.08, "sine", 0.2, 45); }
  playCash() { this.tone(880, 0.1, "square", 0.14); setTimeout(() => this.tone(1320, 0.16, "square", 0.14), 90); }
  playSirenBlip() { this.tone(660, 0.14, "square", 0.1, 990); }
  playExplosion() { this.noise(0.55, 0.4); this.tone(70, 0.5, "sine", 0.34, 28); }
  playHorn() { this.tone(340, 0.18, "square", 0.1); }

  // A tiny sunset-funk loop: bass notes cycling under a soft lead.
  updateMusic(dt, wanted) {
    if (!this.context || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = wanted >= 3 ? 0.24 : 0.34;
    const bassLine = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    const leadLine = [220, 261.6, 329.6, 261.6, 293.7, 220, 196, 246.9];
    const i = this.noteIndex % bassLine.length;
    this.tone(bassLine[i] * 2, 0.3, "triangle", 0.2, null, this.musicGain);
    if (this.noteIndex % 2 === 0) this.tone(leadLine[i], 0.22, "sine", 0.1, null, this.musicGain);
    this.noteIndex += 1;
  }
}

export function createAudio() {
  return new AudioEngine();
}
