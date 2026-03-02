"use client";

/**
 * Audio Engine for Relief Activities
 * ====================================
 * Uses Web Audio API to generate calming sounds without external files.
 * - Ambient pad (warm sine/triangle layered drone)
 * - Breathing cues (gentle rise/fall tone)
 * - Chime (completion ding)
 * - Rain (white noise filtered)
 * - Heartbeat (low sub pulse)
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
  }
  if (_ctx.state === "suspended") {
    _ctx.resume();
  }
  return _ctx;
}

/* ── Ambient Pad ─────────────────────────────────────────────────────── */
let ambientNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

export function startAmbient(volume = 0.12) {
  const ctx = getCtx();
  if (ambientNodes) return;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2);
  gain.connect(ctx.destination);

  // Warm layered drone — root + fifth
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(110, ctx.currentTime); // A2
  const g1 = ctx.createGain();
  g1.gain.value = 0.6;
  osc1.connect(g1).connect(gain);
  osc1.start();

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3 — perfect fifth
  const g2 = ctx.createGain();
  g2.gain.value = 0.4;
  osc2.connect(g2).connect(gain);
  osc2.start();

  // Slow LFO on osc1 frequency for movement
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05; // very slow
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain).connect(osc1.frequency);
  lfo.start();

  ambientNodes = { osc1, osc2, gain };
}

export function stopAmbient() {
  if (!ambientNodes || !_ctx) return;
  const ctx = _ctx;
  const { osc1, osc2, gain } = ambientNodes;
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  setTimeout(() => {
    try { osc1.stop(); osc2.stop(); } catch { /* already stopped */ }
    ambientNodes = null;
  }, 2000);
}

/* ── Breathing Tone ──────────────────────────────────────────────────── */
let breathOsc: OscillatorNode | null = null;
let breathGain: GainNode | null = null;

export function startBreathTone() {
  const ctx = getCtx();
  if (breathOsc) return;

  breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0, ctx.currentTime);
  breathGain.connect(ctx.destination);

  breathOsc = ctx.createOscillator();
  breathOsc.type = "sine";
  breathOsc.frequency.setValueAtTime(220, ctx.currentTime);
  breathOsc.connect(breathGain);
  breathOsc.start();
}

export function breathInhale(durationSec: number) {
  if (!breathGain || !breathOsc || !_ctx) return;
  const ctx = _ctx;
  breathGain.gain.cancelScheduledValues(ctx.currentTime);
  breathGain.gain.setValueAtTime(breathGain.gain.value, ctx.currentTime);
  breathGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + durationSec);
  breathOsc.frequency.linearRampToValueAtTime(330, ctx.currentTime + durationSec);
}

export function breathExhale(durationSec: number) {
  if (!breathGain || !breathOsc || !_ctx) return;
  const ctx = _ctx;
  breathGain.gain.cancelScheduledValues(ctx.currentTime);
  breathGain.gain.setValueAtTime(breathGain.gain.value, ctx.currentTime);
  breathGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + durationSec);
  breathOsc.frequency.linearRampToValueAtTime(220, ctx.currentTime + durationSec);
}

export function breathHold() {
  // just sustain current state — no change
}

export function stopBreathTone() {
  if (breathOsc) {
    try { breathOsc.stop(); } catch { /* already stopped */ }
    breathOsc = null;
  }
  breathGain = null;
}

/* ── Completion Chime ────────────────────────────────────────────────── */
export function playChime() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Three-note ascending chime
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.15 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.8);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 1);
  });
}

/* ── Rain / White-noise ──────────────────────────────────────────────── */
let rainNode: AudioBufferSourceNode | null = null;
let rainGain: GainNode | null = null;

export function startRain(volume = 0.06) {
  const ctx = getCtx();
  if (rainNode) return;

  // Generate pink-ish noise buffer (2 seconds, looped)
  const sr = ctx.sampleRate;
  const len = sr * 2;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  rainNode = ctx.createBufferSource();
  rainNode.buffer = buf;
  rainNode.loop = true;

  // Lowpass for rain effect
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.5;

  rainGain = ctx.createGain();
  rainGain.gain.setValueAtTime(0, ctx.currentTime);
  rainGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);

  rainNode.connect(filter).connect(rainGain).connect(ctx.destination);
  rainNode.start();
}

export function stopRain() {
  if (rainGain && _ctx) {
    rainGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 1);
  }
  setTimeout(() => {
    try { rainNode?.stop(); } catch { /* ok */ }
    rainNode = null;
    rainGain = null;
  }, 1500);
}

/* ── Heartbeat (low sub pulse) ─────────────────────────────────────── */
let hbInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(bpm = 60) {
  const ctx = getCtx();
  if (hbInterval) return;

  function beat() {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 55; // sub bass A1

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  beat();
  hbInterval = setInterval(beat, (60 / bpm) * 1000);
}

export function stopHeartbeat() {
  if (hbInterval) {
    clearInterval(hbInterval);
    hbInterval = null;
  }
}

/* ── Master stop ──────────────────────────────────────────────────────── */
export function stopAll() {
  stopAmbient();
  stopBreathTone();
  stopRain();
  stopHeartbeat();
}
