// Programmatic score: 16-bit mono PCM, deterministic, locked to the project's beat grid.
// Kick on every beat, hat on the off-beat, a bass line that changes every 4 beats,
// a soft pad, and an accent hit on every scene cut.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { renderSfx, validateEvent } from './sfx.mjs';

const SR = 44100;

function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// opts.events: extra sound effects [{t, name, gain?}] in seconds from the start of the film.
// opts.placed: an array that receives the list of effects that were mixed in.
export function synth(project, file, opts = {}) {
  const total = Math.round(project.seconds * SR);
  const buf = new Float32Array(total);
  const add = (t0, len, fn) => {
    const a = Math.round(t0 * SR);
    for (let i = 0; i < len * SR && a + i < total; i++) buf[a + i] += fn(i / SR);
  };
  const beatSec = project.beatSec;
  const nBeats = Math.round(project.seconds / beatSec);
  const rnd = lcg(7);

  const roots = [45, 41, 43, 40]; // A, F, G, E
  for (let b = 0; b < nBeats; b++) {
    const t = b * beatSec;
    add(t, 0.28, (x) => Math.sin(2 * Math.PI * (48 + 110 * Math.exp(-x * 28)) * x) * Math.exp(-x * 11) * 0.9);
    add(t + beatSec / 2, 0.06, (x) => rnd() * Math.exp(-x * 90) * 0.18);
    const note = roots[Math.floor(b / 4) % roots.length];
    add(t, beatSec * 0.92, (x) => {
      const f = midi(note);
      const env = Math.min(1, x * 80) * Math.exp(-x * 3);
      return (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(4 * Math.PI * f * x)) * env * 0.22;
    });
  }
  // pad: a soft triad per bar, crossfaded by a slow envelope
  for (let bar = 0; bar * 4 < nBeats; bar++) {
    const t = bar * 4 * beatSec;
    const dur = 4 * beatSec;
    const root = roots[bar % roots.length] + 24;
    for (const iv of [0, 3, 7]) {
      add(t, dur + 0.2, (x) => {
        const env = Math.min(1, x / 0.35) * Math.min(1, (dur + 0.2 - x) / 0.25);
        return Math.sin(2 * Math.PI * midi(root + iv) * x) * env * 0.05;
      });
    }
  }
  // cut accents land exactly on scene starts, unless the project names a sound effect for cuts
  if (!project.cutSfx) {
    for (const s of project.scenes) {
      const t = s.start / project.fps;
      add(t, 0.5, (x) => (Math.sin(2 * Math.PI * 880 * x) * 0.6 + rnd() * 0.4) * Math.exp(-x * 14) * 0.25);
    }
  }

  // The music is levelled on its own first, so sound effects sit on top of it at a known loudness
  // instead of being squashed by whatever happens to be loudest in the mix.
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const musicGain = peak > 0 ? 0.55 / peak : 1;
  for (let i = 0; i < total; i++) buf[i] *= musicGain;

  const placed = [];
  const events = [...(opts.events ?? [])];
  if (project.cutSfx) {
    validateEvent({ t: 0, name: project.cutSfx }, 'project.json cutSfx', 0);
    for (const s of project.scenes.slice(1)) events.push({ t: s.start / project.fps - 0.12, name: project.cutSfx, gain: 0.5, cut: true });
  }
  for (const ev of events) {
    const t0 = ev.t;
    if (!Number.isFinite(t0)) throw new Error(`${ev.where ?? 'sound event'}: t is not a number`);
    const sound = renderSfx(ev.name, ev);
    const a = Math.round(t0 * SR), g = ev.gain ?? 0.5;
    let wrote = 0;
    for (let i = 0; i < sound.length; i++) {
      const j = a + i;
      if (j >= 0 && j < total && Math.abs(sound[i]) > 1e-4) { buf[j] += sound[i] * g; wrote++; }
    }
    // Only effects that put real samples in the film are listed. One in the last 0.4 s sits under the end fade.
    if (wrote > 0 && t0 < project.seconds - 0.4) placed.push({ t: Math.round(t0 * 1000) / 1000, name: ev.name });
  }
  opts.placed?.push(...placed);

  // soft limiter so stacked sounds never clip, then a short fade at the end
  const fade = Math.round(0.4 * SR);
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) out[i] = Math.tanh(buf[i] * 1.05) * 0.95 * Math.min(1, (total - i) / fade);
  writeWav(file, out);
  return file;
}

export function writeWav(file, samples) {
  const total = samples.length;
  const pcm = Buffer.alloc(44 + total * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + total * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, pcm);
}
