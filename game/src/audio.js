// audio.js — seluruh bunyi dibuat langsung dengan WebAudio, tanpa berkas audio.
// Ada sirene dua nada, dengung mesin, efek tembakan/pukulan/tabrak, blip antarmuka,
// bunyi uang, dan bassline malam yang berputar pelan di latar.
let ctx = null, master = null, muted = false;
let sirenNodes = null, engineNodes = null, musicTimer = null;

export function isMuted() { return muted; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playShot() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.18);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.2);
}

export function playPunch() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.14);
}

export function playBlip(freq = 660) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
}

export function playCash() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  [880, 1174, 1568].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    const st = t + i * 0.07;
    g.gain.setValueAtTime(0.14, st); g.gain.exponentialRampToValueAtTime(0.001, st + 0.16);
    o.connect(g); g.connect(master); o.start(st); o.stop(st + 0.18);
  });
}

export function playCrash() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.3);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.32);
}

export function updateSiren(wanted, dt) {
  if (!ctx) return;
  if (wanted <= 0) { stopSiren(); return; }
  if (!sirenNodes) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0.05;
    o.connect(g); g.connect(master); o.start();
    sirenNodes = { o, g, phase: 0 };
  }
  const s = sirenNodes;
  s.phase += dt;
  const hi = Math.floor(s.phase * 1.6) % 2 === 0;
  s.o.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.03);
  s.g.gain.setTargetAtTime(Math.min(0.02 + wanted * 0.012, 0.07), ctx.currentTime, 0.1);
}

function stopSiren() {
  if (!sirenNodes) return;
  try { sirenNodes.o.stop(); } catch (e) { /* node mungkin sudah berhenti */ }
  sirenNodes = null;
}

export function updateEngine(speed01, driving) {
  if (!ctx) return;
  if (!driving || speed01 <= 0.02) {
    if (engineNodes) { try { engineNodes.o.stop(); } catch (e) {} engineNodes = null; }
    return;
  }
  if (!engineNodes) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.04;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    engineNodes = { o, g };
  }
  engineNodes.o.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.06);
}

function startMusic() {
  if (musicTimer) return;
  const notes = [55, 0, 55, 65.4, 0, 55, 49, 58.3];
  let step = 0;
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const f = notes[step % notes.length];
    step++;
    if (!f) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
  }, 260);
}
