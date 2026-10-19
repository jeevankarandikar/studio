// Finds dead frames: runs where consecutive frames barely change.
// One ffmpeg pass downsamples every frame to 96x54 gray, then we diff neighbours.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const W = 96, H = 54;

export function frameDeltas(project) {
  const r = spawnSync('ffmpeg', [
    '-loglevel', 'error', '-framerate', String(project.fps), '-start_number', '1',
    '-i', join(project.framesDir, '%05d.png'),
    '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg decode failed');
  const raw = r.stdout, size = W * H, n = Math.floor(raw.length / size);
  const deltas = new Float32Array(n); // deltas[i] = change from frame i-1 to i
  for (let i = 1; i < n; i++) {
    let sum = 0;
    for (let p = 0; p < size; p++) sum += Math.abs(raw[i * size + p] - raw[(i - 1) * size + p]);
    deltas[i] = sum / size;
  }
  return deltas;
}

// A frame is dead when it moves less than `eps` gray levels on average. A run of
// `minRun` or more dead frames is a dead stretch (0.27s at 30 fps by default).
export function deadRuns(deltas, scene, { eps = 0.05, minRun = 8 } = {}) {
  const runs = [];
  let start = null;
  const end = scene.start + scene.frames;
  for (let i = scene.start; i <= end; i++) {
    const dead = i < end && deltas[i] < eps && i > 0;
    if (dead && start === null) start = i;
    if (!dead && start !== null) {
      if (i - start >= minRun) runs.push({ from: start - scene.start, to: i - 1 - scene.start, frames: i - start });
      start = null;
    }
  }
  return runs;
}

export function sceneMotion(deltas, scene) {
  let s = 0;
  for (let i = scene.start; i < scene.start + scene.frames; i++) s += deltas[i] ?? 0;
  return s / scene.frames;
}
