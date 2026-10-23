// Per-scene 1-10 score. Mechanical rubric first; an optional visual review from a
// fresh-context reviewer (out/<tag>/review.json) can only lower the score.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { frameDeltas, deadRuns, sceneMotion } from './deadframes.mjs';
import { lintScene } from '../lint.mjs';

// Tiles exactly the listed frames (0-based global frame numbers, ascending, distinct) into one image. Picking by
// explicit frame number means the sheet always covers the whole span asked for, never just its first rows.
function tileFrames(project, name, frames, cols, rows, width) {
  const dir = join(project.out, 'sheets');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.jpg`);
  const sel = frames.map((n) => `eq(n\\,${n})`).join('+');
  const r = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(project.fps), '-start_number', '1', '-i', join(project.framesDir, '%05d.png'),
    '-vf', `select='${sel}',scale=${width}:-1,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '4', file,
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${name} failed: ${String(r.stderr).split('\n')[0]}`);
  return file;
}

// n frames spread evenly from `from` for `span` frames, distinct and ascending even when span < n.
function spread(from, span, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = from + Math.min(span - 1, Math.floor((i * span) / n));
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

// One contact sheet per scene: 8 evenly spaced frames, downscaled, for the reviewer to read.
export function contactSheet(project, scene) {
  return tileFrames(project, `scene-${scene.index}`, spread(scene.start, scene.frames, 8), 4, 2, 480);
}

// Consecutive frames, not spread-out ones: 5 before and 5 after a cut shows whether the hand-off is clean,
// and 10 in a row around a frame shows how a fast move actually travels.
function strip(project, name, centerFrame) {
  const from = Math.max(0, Math.min(project.totalFrames - 10, centerFrame - 5));
  const file = tileFrames(project, name, Array.from({ length: 10 }, (_, i) => from + i), 5, 2, 384);
  return { file, from, to: from + 9 };
}

export function cutStrips(project) {
  return project.scenes.slice(1).map((s) => ({ cut: s.index, ...strip(project, `cut-${s.index}`, s.start) }));
}

// The fastest-moving moment in each scene, shown as 10 consecutive frames.
export function motionStrips(project, deltas) {
  return project.scenes.map((s) => {
    let best = s.start + 1, top = -1;
    for (let i = s.start + 5; i < s.start + s.frames - 5; i++) if (deltas[i] > top) { top = deltas[i]; best = i; }
    return { scene: s.index, ...strip(project, `peak-${s.index}`, best) };
  });
}

// One sheet for the whole film, for a reviewer who is not allowed to hear it.
export function filmSheet(project) {
  return tileFrames(project, 'film', spread(0, project.totalFrames, 12), 4, 3, 480);
}

export { frameDeltas };

// Attention proxies measurable without a model. They are reported, not scored: the reviewer
// (rubric.md checks 8-10) judges whether a long shot or a missing caption actually hurts,
// and its verdict can only lower the score through review.json. What cannot be measured here
// — hook legibility, first-read clarity, caption size at phone size — stays reviewer-only.
export function attentionProxies(project, scene, dead) {
  const longestStaticRun = dead.reduce((m, d) => Math.max(m, d.frames), 0);
  return {
    longestStaticRun,
    longestShotSec: Math.round((scene.frames / project.fps) * 100) / 100,
    cuts: Math.max(0, project.scenes.length - 1),
    captions: project.captions.length,
  };
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
    const attention = attentionProxies(project, scene, dead);
    if (attention.longestShotSec > 10) notes.push(`long unbroken shot ${attention.longestShotSec}s (attention: change frequency)`);
    if (scene.index === 0 && attention.captions === 0) notes.push('no captions in project.json (attention: caption readability)');
    return { scene: scene.index, file: scene.file.split('/').pop(), score, motion: Math.round(motion * 100) / 100, dead, notes, sheet: contactSheet(project, scene), attention };
  });
}
