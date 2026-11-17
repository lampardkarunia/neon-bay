// audio.js — WebAudio synth: engine hum, sirens, shots, pickup jingle, music loop
export function createAudio() {
  let ctx = null, master = null, muted = false, musicTimer = null, sirenOsc = null, sirenGain = null;
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
      startMusic();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type = "square", vol = 0.5, slideTo = null) {
    if (!ensure() || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function startMusic() {
    const notes = [196, 220, 262, 330, 262, 220, 175, 220];
    let i = 0;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      tone(notes[i % notes.length], 0.42, "triangle", 0.16);
      if (i % 2 === 0) tone(notes[i % notes.length] / 2, 0.5, "sine", 0.2);
      i++;
    }, 430);
  }
  function setSiren(active) {
    if (!ensure()) return;
    if (active && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
      sirenOsc.type = "triangle"; sirenGain.gain.value = muted ? 0 : 0.05;
      const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
      lfo.frequency.value = 0.7; lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.frequency.value = 720;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); lfo.start(); sirenOsc._lfo = lfo;
    } else if (!active && sirenOsc) {
      try { sirenOsc.stop(); sirenOsc._lfo.stop(); } catch { /* already stopped */ }
      sirenOsc = null; sirenGain = null;
    }
    if (sirenGain) sirenGain.gain.value = muted ? 0 : 0.05;
  }
  return {
    unlock() { ensure(); },
    punch() { tone(120, 0.08, "square", 0.4, 60); },
    shoot() { tone(880, 0.09, "sawtooth", 0.35, 140); },
    pickup() { tone(660, 0.12, "sine", 0.4); setTimeout(() => tone(990, 0.18, "sine", 0.4), 90); },
    crash() { tone(90, 0.25, "sawtooth", 0.5, 40); },
    explosion() { tone(60, 0.7, "sawtooth", 0.7, 28); },
    enterCar() { tone(330, 0.1, "sine", 0.3); },
    setSiren,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.22; return muted; },
    isMuted() { return muted; },
  };
}
