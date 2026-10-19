// Per-scene 1-10 score. Mechanical rubric first; an optional visual review from a
// fresh-context reviewer (out/<tag>/review.json) can only lower the score.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { frameDeltas, deadRuns, sceneMotion } from './deadframes.mjs';
import { lintScene } from '../lint.mjs';

// One contact sheet per scene: 8 evenly spaced frames, downscaled, for the reviewer to read.
export function contactSheet(project, scene) {
  const dir = join(project.out, 'sheets');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `scene-${scene.index}.jpg`);
  const step = Math.max(1, Math.floor(scene.frames / 8));
  const sel = `select='not(mod(n\\,${step}))*gte(n\\,${scene.start})*lt(n\\,${scene.start + scene.frames})'`;
  const r = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(project.fps), '-start_number', '1', '-i', join(project.framesDir, '%05d.png'),
    '-vf', `${sel},scale=480:-1,tile=4x2`, '-frames:v', '1', '-q:v', '4', file,
  ]);
  if (r.status !== 0) throw new Error(`contact sheet for scene ${scene.index} failed: ${String(r.stderr).split('\n')[0]}`);
  return file;
}

export function scoreProject(project) {
  const deltas = frameDeltas(project);
  // The review belongs to one format's render, and render() drops a scene's entry when the scene is re-rendered.
  const reviewFile = join(project.out, 'review.json');
  const review = existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, 'utf8')) : {};
  return project.scenes.map((scene) => {
    const notes = [];
    let score = 10;
    const dead = deadRuns(deltas, scene);
    for (const d of dead) { score -= Math.min(2, 0.5 + d.frames / 12); notes.push(`dead frames ${d.from}-${d.to}`); }
    const motion = sceneMotion(deltas, scene);
    if (motion < 0.4) { score -= 2; notes.push(`low motion density ${motion.toFixed(2)}`); }
    if (!scene.onBeat) { score -= 3; notes.push('cut off the beat'); }
    const lint = lintScene(scene.file);
    if (lint.length) { score -= 3; notes.push(...lint); }
    score = Math.max(1, Math.round(score * 10) / 10);
    const r = review[scene.index];
    if (r) { if (r.score < score) score = r.score; if (r.notes) notes.push(`review: ${r.notes}`); }
    return { scene: scene.index, file: scene.file.split('/').pop(), score, motion: Math.round(motion * 100) / 100, dead, notes, sheet: contactSheet(project, scene) };
  });
}
