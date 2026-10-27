import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { loadProject, loadBrand, missingAssets } from './project.mjs';
import { lintProject } from './lint.mjs';
import { capture } from './capture.mjs';
import { synth } from './audio/synth.mjs';
import { stitch } from './stitch.mjs';
import { verify, summary, hasFullReview } from './verify.mjs';
import { validateEvent } from './audio/sfx.mjs';

// The frame files only make sense for one layout of scenes. If scene lengths, order or size changed since the
// last render, or frames are missing, re-rendering a subset would stitch shifted or absent footage.
function layoutSignature(project) {
  return JSON.stringify({ w: project.width, h: project.height, fps: project.fps, s: project.scenes.map((s) => [s.file, s.start, s.frames]) });
}

function needsFullRender(project) {
  const manifest = join(project.framesDir, 'manifest.json');
  if (!existsSync(manifest)) return 'no earlier render of this project';
  if (readFileSync(manifest, 'utf8') !== layoutSignature(project)) return 'scene layout changed';
  const have = readdirSync(project.framesDir).filter((f) => /^\d{5}\.png$/.test(f)).length;
  if (have < project.totalFrames) return `only ${have} of ${project.totalFrames} frames on disk`;
  const noSfx = project.scenes.filter((s) => !existsSync(join(project.framesDir, `sfx-${s.index}.json`)));
  if (noSfx.length) return `sound events not recorded for scene ${noSfx.map((s) => s.index).join(', ')}`;
  return null;
}

// A reviewer's verdict is about the frames it saw; drop it for any scene we are about to redraw.
function dropStaleReviews(project, scenes) {
  const f = join(project.out, 'review.json');
  if (!existsSync(f)) return;
  const r = JSON.parse(readFileSync(f, 'utf8'));
  for (const i of scenes) delete r[i];
  writeFileSync(f, JSON.stringify(r, null, 2) + '\n');
}

export async function render(name, { scenes = null, doStitch = true, format = null, workers } = {}) {
  const project = loadProject(name, { format });
  const brand = loadBrand(project.dir);

  const lint = lintProject(name);
  const bad = Object.entries(lint).flatMap(([i, h]) => h.map((x) => `scene ${i}: ${x}`));
  if (bad.length) throw new Error('lint failed\n  ' + bad.join('\n  '));

  const miss = missingAssets(project);
  if (miss.length) throw new Error('missing assets\n  ' + miss.join('\n  '));

  const off = project.scenes.filter((s) => !s.onBeat).map((s) => s.index);
  if (off.length) throw new Error(`scenes ${off} do not end on a beat at ${project.fps} fps`);

  if (scenes) {
    const badIdx = scenes.filter((i) => !Number.isInteger(i) || i < 0 || i >= project.scenes.length);
    if (badIdx.length) throw new Error(`no such scene: ${badIdx.join(', ')} (project has ${project.scenes.length}, numbered from 0)`);
  }
  mkdirSync(project.framesDir, { recursive: true });
  let idx = scenes ?? project.scenes.map((s) => s.index);
  if (scenes) {
    const why = needsFullRender(project);
    if (why) { console.log(`rendering every scene: ${why}`); idx = project.scenes.map((s) => s.index); }
  }
  mkdirSync(project.out, { recursive: true });
  dropStaleReviews(project, idx);
  await capture(project, brand, idx, { workers });
  writeFileSync(join(project.framesDir, 'manifest.json'), layoutSignature(project));
  if (!doStitch) return { project };
  // Sound effects: the ones the project lists by beat, plus the ones each scene declared while it was captured.
  const events = [...project.sfx];
  for (const s of project.scenes) {
    const f = join(project.framesDir, `sfx-${s.index}.json`);
    if (!existsSync(f)) continue;
    JSON.parse(readFileSync(f, 'utf8')).forEach((e, k) => {
      const where = `scene ${s.index} (${s.file.split('/').pop()}) sfx[${k}]`;
      validateEvent(e, where, s.frames / project.fps);
      events.push({ ...e, t: s.start / project.fps + e.t, where });
    });
  }
  const placed = [];
  const wav = synth(project, join(project.out, 'score.wav'), { events, placed });
  const mp4 = stitch(project, wav);
  console.log(`wrote ${mp4} (${project.seconds}s, ${project.totalFrames} frames, ${project.width}x${project.height}, ${placed.length} sound effects)`);
  const m = verify(project, { sfxPlaced: placed, hasReview: hasFullReview(project) });
  console.log(summary(m));
  return { project, mp4, manifest: m };
}
