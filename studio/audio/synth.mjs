// Programmatic score: 16-bit mono PCM, deterministic, locked to the project's beat grid.
// Kick on every beat, hat on the off-beat, a bass line that changes every 4 beats,
// a soft pad, and an accent hit on every scene cut.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SR = 44100;

function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function synth(project, file) {
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
  // cut accents land exactly on scene starts
  for (const s of project.scenes) {
    const t = s.start / project.fps;
    add(t, 0.5, (x) => (Math.sin(2 * Math.PI * 880 * x) * 0.6 + rnd() * 0.4) * Math.exp(-x * 14) * 0.25);
  }

  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.round(0.4 * SR);
  const pcm = Buffer.alloc(44 + total * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + total * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) {
    const tail = Math.min(1, (total - i) / fade);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * g * tail * 32767))), 44 + i * 2);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, pcm);
  return file;
}
