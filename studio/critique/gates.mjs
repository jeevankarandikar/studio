// Approval gates: style stills first, then a low-fps animatic with sound, then the full render.
// The pattern is the two-gate loop used by public code-drawn video tools: approve cheap stills
// before paying for frames, approve the timed sketch before paying for the full film.
// Approval lives in out/<tag>/gates/approval.json, never in scenes/, so a gate decision is
// project state, not scene source. Gates reuse capture(); they never duplicate it.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject, loadBrand } from '../project.mjs';
import { capture } from '../capture.mjs';
import { synth } from '../audio/synth.mjs';
import { render } from '../render.mjs';

export const ANIMATIC_FPS = 6; // sketch speed: every 5th frame at 30 fps
const STRIDE = 5;

export function gatesDir(project) { return join(project.out, 'gates'); }
export function approvalFile(project) { return join(gatesDir(project), 'approval.json'); }

export function loadApproval(project) {
  const f = approvalFile(project);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8'));
}

function saveApproval(project, approval) {
  mkdirSync(gatesDir(project), { recursive: true });
  writeFileSync(approvalFile(project), JSON.stringify(approval, null, 2) + '\n');
}

function freshApproval(project) {
  const scenes = {};
  for (const s of project.scenes) scenes[s.index] = 'pending';
  return { version: 1, scenes, animatic: null, stills: [], animaticFile: null };
}

// One frame per scene, at the scene midpoint: the cheapest possible look at the whole film.
export async function renderStills(project, brand, indexes = null) {
  const dir = join(gatesDir(project), 'stills');
  mkdirSync(dir, { recursive: true });
  const idx = indexes ?? project.scenes.map((s) => s.index);
  // capture() takes one frames list for all scenes, so stills go scene by scene, one midpoint
  // frame each. One browser per scene is still far cheaper than a full render.
  for (const i of idx) {
    const s = project.scenes[i];
    await capture(project, brand, [i], {
      frames: [Math.floor(s.frames / 2)], outDir: dir, type: 'png', workers: 1, log: () => {},
      name: (sc, f) => `scene-${sc.index}.png`,
    });
  }
  return idx.map((i) => join(dir, `scene-${i}.png`));
}

function parseIndexes(v, project, flag) {
  const out = [];
  for (const part of String(v).split(',')) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n < 0 || n >= project.scenes.length) throw new Error(`--${flag} needs scene numbers 0..${project.scenes.length - 1}, got "${part.trim()}"`);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// Renumber strided frames to a gapless sequence ffmpeg can read as one clip.
function renumber(dir) {
  const files = readdirSync(dir).filter((f) => /^\d{5}\.png$/.test(f)).sort();
  files.forEach((f, k) => renameSync(join(dir, f), join(dir, `tmp-${String(k + 1).padStart(5, '0')}.png`)));
  files.forEach((_, k) => renameSync(join(dir, `tmp-${String(k + 1).padStart(5, '0')}.png`), join(dir, `${String(k + 1).padStart(5, '0')}.png`)));
  return files.length;
}

// A timed sketch: every 5th frame at 6 fps, with the synthesized score and project-level effects.
// Scene-level effects are not in the animatic (they are only recorded during a full capture);
// the sketch proves timing, order and music, not the final mix.
export async function renderAnimatic(project, brand) {
  const dir = join(gatesDir(project), 'animatic-frames');
  mkdirSync(dir, { recursive: true });
  for (const s of project.scenes) {
    const frames = [];
    for (let f = 0; f < s.frames; f += STRIDE) frames.push(f);
    await capture(project, brand, [s.index], {
      frames, outDir: dir, type: 'png', workers: 4, log: () => {},
      name: (sc, f) => `${String(sc.start + f + 1).padStart(5, '0')}.png`,
    });
  }
  const n = renumber(dir);
  if (!n) throw new Error('animatic: no frames captured');
  const wav = join(gatesDir(project), 'animatic-score.wav');
  synth(project, wav, { events: project.sfx });
  const out = join(gatesDir(project), 'animatic.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-framerate', String(ANIMATIC_FPS), '-start_number', '1', '-i', join(dir, '%05d.png'),
    '-i', wav, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg animatic failed: ${String(r.stderr).split('\n')[0]}`);
  return out;
}

function statusLines(project, approval) {
  const lines = project.scenes.map((s) => `  scene ${s.index} ${s.file.split('/').pop()}: ${approval.scenes[s.index]}`);
  lines.push(`  animatic: ${approval.animatic ?? 'not rendered'}`);
  return lines.join('\n');
}

// Advance the gate one stage, or record a decision. Returns a short stage name for the CLI.
export async function gateRun(name, { approve = null, reject = null, approveAnimatic = false, restill = false } = {}) {
  const project = loadProject(name);
  const brand = loadBrand(project.dir);
  let approval = loadApproval(project);

  if (!approval) {
    const stills = await renderStills(project, brand);
    approval = freshApproval(project);
    approval.stills = stills;
    saveApproval(project, approval);
    console.log(`stills:\n  ${stills.join('\n  ')}\n\napprove scenes with: studio gate ${name} --approve 0,1\nreject with: studio gate ${name} --reject 1`);
    return 'stills';
  }

  if (restill) {
    const rejected = project.scenes.filter((s) => approval.scenes[s.index] === 'rejected').map((s) => s.index);
    const idx = rejected.length ? rejected : project.scenes.map((s) => s.index);
    await renderStills(project, brand, idx);
    for (const i of idx) approval.scenes[i] = 'pending';
    if (approval.animaticFile && existsSync(approval.animaticFile)) unlinkSync(approval.animaticFile);
    approval.animatic = null;
    approval.animaticFile = null;
    saveApproval(project, approval);
    console.log(`re-rendered stills for scene(s) ${idx.join(', ')}; they are pending again`);
    return 'stills';
  }

  if (approve !== null) for (const i of parseIndexes(approve, project, 'approve')) approval.scenes[i] = 'approved';
  if (reject !== null) for (const i of parseIndexes(reject, project, 'reject')) approval.scenes[i] = 'rejected';
  if (approve !== null || reject !== null) saveApproval(project, approval);

  const rejected = project.scenes.filter((s) => approval.scenes[s.index] === 'rejected');
  if (rejected.length) {
    console.log(`rejected: scene(s) ${rejected.map((s) => s.index).join(', ')} — fix the scene(s), then: studio gate ${name} --restill`);
    console.log(statusLines(project, approval));
    return 'blocked';
  }
  const pending = project.scenes.filter((s) => approval.scenes[s.index] === 'pending');
  if (pending.length) {
    console.log(`waiting on scene(s) ${pending.map((s) => s.index).join(', ')}`);
    console.log(statusLines(project, approval));
    return 'waiting';
  }

  if (!approval.animaticFile) {
    const out = await renderAnimatic(project, brand);
    approval.animatic = 'pending';
    approval.animaticFile = out;
    saveApproval(project, approval);
    console.log(`animatic: ${out}\nwatch it, then: studio gate ${name} --approve-animatic`);
    return 'animatic';
  }
  if (approveAnimatic) {
    approval.animatic = 'approved';
    saveApproval(project, approval);
  }
  if (approval.animatic !== 'approved') {
    console.log(`animatic waiting on approval: ${approval.animaticFile}`);
    console.log(statusLines(project, approval));
    return 'waiting';
  }

  console.log('gates approved — rendering full film');
  await render(name, {});
  return 'rendered';
}
