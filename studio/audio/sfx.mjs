// Synthesized sound effects. Every sound is computed from oscillators, filtered noise and envelopes,
// so there is nothing to license and every render is identical. Mono Float32 at 44.1 kHz.
//
//   renderSfx('click') -> Float32Array
//   events: { t, name, gain?, dur?, cps?, seed? } placed by studio/audio/synth.mjs
//
// 'type' is a burst of keystrokes: { t, name:'type', dur: 1.2, cps: 14 }.
export const SR = 44100;

function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
const TAU = Math.PI * 2;

// State-variable band-pass filter, one sample at a time. f in Hz, q about 1 to 8.
function bandpass() {
  let lp = 0, bp = 0;
  return (x, f, q) => {
    const g = 2 * Math.sin(Math.PI * Math.min(f, SR * 0.45) / SR);
    lp += g * bp;
    const hp = x - lp - bp / q;
    bp += g * hp;
    return bp;
  };
}
function lowpass() { let y = 0; return (x, f) => (y += (1 - Math.exp(-TAU * f / SR)) * (x - y)); }
function highpass() { const lp = lowpass(); return (x, f) => x - lp(x, f); }

function make(sec, fn) {
  const n = Math.round(sec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}
const env = (t, attack, decay) => Math.min(1, t / attack) * Math.exp(-t * decay);

const BUILD = {
  // a soft UI click: a tick of high noise and a short ping
  click({ seed = 1 }) {
    const r = lcg(seed), hp = highpass();
    return make(0.06, (t) => hp(r(), 3000) * Math.exp(-t * 380) * 0.5 + Math.sin(TAU * 1800 * t) * Math.exp(-t * 110) * 0.35);
  },
  // a single mechanical key: a low thock, a bright clack, and a touch of case resonance
  key({ seed = 1 }) {
    const r = lcg(seed), lp = lowpass(), hp = highpass();
    const f0 = 150 + (lcg(seed * 7 + 3)() + 1) * 25;
    return make(0.1, (t) =>
      lp(r(), 2200) * Math.exp(-t * 520) * 0.5 +
      Math.sin(TAU * f0 * t) * Math.exp(-t * 70) * 0.55 +
      hp(r(), 2500) * Math.exp(-t * 900) * 0.3 +
      Math.sin(TAU * 2300 * t) * Math.exp(-t * 400) * 0.08);
  },
  // a fast clock tick
  tick() {
    return make(0.04, (t) => Math.sin(TAU * 1250 * t) * Math.exp(-t * 170) * 0.6);
  },
  // a bubble pop: a quick sine sweep rising from 300 to 900 Hz (phase is the integral of the frequency)
  pop() {
    return make(0.12, (t) => Math.sin(TAU * (900 * t + 15 * (Math.exp(-40 * t) - 1))) * Math.exp(-t * 36) * 0.7);
  },
  // air moving across the frame: noise through a band that sweeps up, in a bell envelope
  whoosh({ dur = 0.5, up = true }) {
    const r = lcg(11), bp = bandpass();
    return make(dur, (t) => {
      const u = t / dur, f = up ? 350 + 3400 * u * u : 3800 - 3400 * u;
      return bp(r(), f, 1.6) * Math.sin(Math.PI * Math.min(1, u)) ** 2 * 0.9;
    });
  },
  // a shorter, brighter swipe for small transitions
  swipe({ dur = 0.22 }) {
    const r = lcg(5), bp = bandpass();
    return make(dur, (t) => {
      const u = t / dur;
      return bp(r(), 1200 + 4200 * u, 2.2) * Math.sin(Math.PI * u) * 0.8;
    });
  },
  // a low impact
  thud() {
    return make(0.45, (t) => Math.sin(TAU * (48 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) * 0.95);
  },
  // an impact with a noise crack on top
  hit() {
    const r = lcg(3), lp = lowpass();
    return make(0.6, (t) => Math.sin(TAU * (42 + 110 * Math.exp(-t * 26)) * t) * Math.exp(-t * 7) * 0.9 + lp(r(), 5000) * Math.exp(-t * 28) * 0.45);
  },
  // tension: rising filtered noise and a rising tone
  riser({ dur = 1.5 }) {
    const r = lcg(9), bp = bandpass();
    return make(dur, (t) => {
      const u = t / dur;
      return (bp(r(), 300 + 6500 * u * u, 2.5) * 0.9 + Math.sin(TAU * (220 + 880 * u * u) * t) * 0.18) * u ** 1.6 * Math.min(1, (dur - t) / 0.03);
    });
  },
  // a gentle bell for a finished thing
  chime() {
    return make(1.1, (t) => (Math.sin(TAU * 880 * t) + 0.5 * Math.sin(TAU * 1320 * t) + 0.25 * Math.sin(TAU * 1760 * t)) * env(t, 0.003, 4.2) * 0.35);
  },
  // two rising notes
  success() {
    return make(1.0, (t) => {
      const a = (Math.sin(TAU * 784 * t) + 0.4 * Math.sin(TAU * 1568 * t)) * env(t, 0.003, 6) * 0.3;
      const t2 = t - 0.11;
      const b = t2 > 0 ? (Math.sin(TAU * 1175 * t2) + 0.4 * Math.sin(TAU * 2350 * t2)) * env(t2, 0.003, 4.5) * 0.3 : 0;
      return a + b;
    });
  },
  // two low buzzes
  error() {
    return make(0.34, (t) => {
      const gate = (t % 0.17) < 0.1 ? 1 : 0;
      return Math.sign(Math.sin(TAU * 118 * t)) * 0.22 * gate * Math.min(1, (0.34 - t) / 0.02);
    });
  },
  // a notification blip
  blip() {
    return make(0.2, (t) => Math.sin(TAU * 1040 * t) * env(t, 0.002, 18) * 0.45 + Math.sin(TAU * 1560 * t) * env(t, 0.002, 22) * 0.2);
  },
  // a camera shutter: two short mechanical clicks
  shutter() {
    const r = lcg(2), hp = highpass();
    return make(0.22, (t) => {
      const a = hp(r(), 1500) * Math.exp(-t * 300);
      const t2 = t - 0.06;
      const b = t2 > 0 ? hp(r(), 900) * Math.exp(-t2 * 220) : 0;
      return (a * 0.5 + b * 0.55) + Math.sin(TAU * 260 * t) * Math.exp(-t * 90) * 0.25;
    });
  },
  // a woosh that comes back down, for elements settling
  settle({ dur = 0.35 }) {
    const r = lcg(13), bp = bandpass();
    return make(dur, (t) => {
      const u = t / dur;
      return bp(r(), 2600 - 2000 * u, 1.4) * Math.sin(Math.PI * u) ** 1.5 * 0.7;
    });
  },
};

export const SFX_NAMES = [...Object.keys(BUILD), 'type'];

// Every sound is capped at a peak of 0.8 so none can clip by itself and the library sits at a similar level.
function level(buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.8) { const g = 0.8 / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

export function renderSfx(name, opts = {}) {
  if (name === 'type') return level(typeBurst(opts));
  if (!Object.hasOwn(BUILD, name)) throw new Error(`unknown sfx "${name}". known: ${SFX_NAMES.join(', ')}`);
  return level(BUILD[name](opts));
}

// Checks one event and says where it came from. Nothing is coerced: a string time or a missing name is an error,
// because a quietly misplaced sound is worse than a failed render. `limit` is the latest allowed t in seconds.
export function validateEvent(e, where, limit) {
  const bad = (m) => { throw new Error(`${where}: ${m}`); };
  if (!e || typeof e !== 'object') bad('an effect must be an object like { t: 0.5, name: "pop" }');
  if (typeof e.t !== 'number' || !Number.isFinite(e.t)) bad(`t must be a number of seconds, got ${JSON.stringify(e.t)}`);
  if (e.t < 0 || e.t > limit) bad(`t ${e.t} is outside 0 to ${Math.round(limit * 1000) / 1000} seconds`);
  if (typeof e.name !== 'string' || !SFX_NAMES.includes(e.name)) bad(`unknown sfx ${JSON.stringify(e.name)}. known: ${SFX_NAMES.join(', ')}`);
  for (const k of ['gain', 'dur', 'cps']) {
    if (e[k] !== undefined && (typeof e[k] !== 'number' || !Number.isFinite(e[k]) || e[k] <= 0)) bad(`${k} must be a positive number, got ${JSON.stringify(e[k])}`);
  }
}

// A run of keystrokes: `cps` per second for `dur` seconds, each key a little different, a space bar thock
// every sixth key.
function typeBurst({ dur = 1, cps = 13, seed = 1 }) {
  const out = new Float32Array(Math.round((dur + 0.15) * SR));
  const r = lcg(seed * 31 + 7);
  const n = Math.max(1, Math.floor(dur * cps));
  for (let k = 0; k < n; k++) {
    const jitter = r() * 0.012;
    const at = Math.max(0, Math.round((k / cps + jitter) * SR));
    const key = BUILD.key({ seed: seed * 100 + k });
    const g = (k % 6 === 5 ? 1.25 : 0.8 + (r() + 1) * 0.12);
    for (let i = 0; i < key.length && at + i < out.length; i++) out[at + i] += key[i] * g;
  }
  return out;
}
