#!/usr/bin/env node
// studio <command> ... ; run `studio help` for the list.
import { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, watch as fsWatch } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProject, loadBrand, ROOT } from './project.mjs';
import { render } from './render.mjs';
import { capture } from './capture.mjs';
import { lintProject } from './lint.mjs';
import { runLoop } from './critique/loop.mjs';
import { gateRun } from './critique/gates.mjs';
import { scoreProject } from './critique/score.mjs';
import { writeBrief, runAuto, writeMuteBrief, runMute } from './critique/review.mjs';
import { verify, summary, hasFullReview } from './verify.mjs';
import { renderSfx, SFX_NAMES } from './audio/sfx.mjs';
import { writeWav } from './audio/synth.mjs';
import { exportWeb } from './stitch.mjs';
import { doctor } from './doctor.mjs';
import { determinism } from './check.mjs';
import { scaffold } from './new.mjs';

const HELP = `studio render <project> [--scene N ...] [--format name] [--workers N] [--no-stitch]
studio loop <project> [--first] [--target 8] [--review] [--format name]
studio lint <project>
studio frame <project> <scene> <frame> [--format name]     one frame to out/<tag>/preview/
studio gate <project> [--approve 0,1] [--reject 2] [--approve-animatic] [--restill]
                                                         stills, then animatic, then full render — approval in out/<tag>/gates/approval.json
studio sheet <project> <scene> [--format name]             8-frame contact sheet in a few seconds
studio watch <project> <scene>                             re-make the sheet whenever the scene file changes
studio review <project> [--auto] [--mute]                  reviewer brief (sheets, cut strips, peak strips), or run it through claude -p; --mute is the no-sound test
studio verify <project>                                    measure the render: loudness, size, first and last frame; writes manifest.json
studio sfx [name | --all]                                  list the sound effects, or write them to ./sfx-audition/ to listen
studio export <project> [--format name]                    web mp4, webm, poster and gif in out/<tag>/web/
studio check <project> [--format name]                     determinism: same frame twice, byte-identical
studio init [dir]                                          in the repo you are in: make ./motion (or dir), fill the brand pack from the repo
studio doctor                                              diagnose node, ffmpeg and the browser
studio list`;

// --key=value is the same as --key value
const argv = process.argv.slice(2).flatMap((a) => (/^--[\w-]+=/.test(a) ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a]));
const cmd = argv[0];
const rest = argv.slice(1);
const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--format', '--target', '--workers', '--scene', '--brand-from', '--approve', '--reject'].includes(rest[i - 1])));
const flag = (n) => rest.includes(n);
const val = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
const all = (n) => rest.reduce((a, x, i) => (x === n ? [...a, rest[i + 1]] : a), []);
const need = (what) => { console.error(`missing ${what}\n\n${HELP}`); process.exit(2); };
const int = (name, v, min = 0) => {
  const n = Number(v);
  if (v === undefined || !Number.isInteger(n) || n < min) { console.error(`${name} needs a whole number of ${min} or more, got "${v ?? ''}"`); process.exit(2); }
  return n;
};
const sceneIn = (project, v) => {
  const n = int('scene', v);
  if (n >= project.scenes.length) { console.error(`no scene ${n}: ${project.name} has ${project.scenes.length} (numbered from 0)`); process.exit(2); }
  return n;
};

function evenFrames(s, n = 8) {
  return Array.from({ length: n }, (_, i) => Math.min(s.frames - 1, Math.floor((i * s.frames) / n)));
}

async function sheet(name, sceneIdx, format) {
  const project = loadProject(name, { format });
  const brand = loadBrand(project.dir);
  const s = project.scenes[sceneIdx];
  if (!s) throw new Error(`no scene ${sceneIdx}`);
  const dir = join(project.out, 'preview');
  mkdirSync(dir, { recursive: true });
  // A scene shorter than 8 frames repeats frames; capture each distinct frame once and reuse it for the tile.
  const wanted = evenFrames(s);
  const distinct = [...new Set(wanted)];
  for (const f of readdirSync(dir)) if (/^t-\d+\.jpg$/.test(f)) unlinkSync(join(dir, f)); // no stale tiles from an earlier sheet
  await capture(project, brand, [sceneIdx], { frames: distinct, outDir: dir, type: 'jpeg', name: (sc, f) => `u-${f}.jpg`, workers: 4, log: () => {} });
  wanted.forEach((f, i) => copyFileSync(join(dir, `u-${f}.jpg`), join(dir, `t-${i}.jpg`)));
  const out = join(dir, `scene-${sceneIdx}.jpg`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-start_number', '0', '-i', join(dir, 't-%d.jpg'), '-vf', 'scale=480:-1,tile=4x2', '-frames:v', '1', '-q:v', '4', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg tile failed: ${String(r.stderr).split('\n')[0]}`);
  return out;
}

try {
  switch (cmd) {
    case 'render': {
      const scenes = all('--scene').map((v) => int('scene', v));
      await render(pos[0] ?? need('project'), { scenes: scenes.length ? scenes : null, doStitch: !flag('--no-stitch'), format: val('--format') ?? null, workers: flag('--workers') ? int('workers', val('--workers'), 1) : undefined });
      break;
    }
    case 'gate': {
      await gateRun(pos[0] ?? need('project'), {
        approve: rest.includes('--approve') ? val('--approve') : null,
        reject: rest.includes('--reject') ? val('--reject') : null,
        approveAnimatic: flag('--approve-animatic'),
        restill: flag('--restill'),
      });
      break;
    }
    case 'loop': {
      const okAll = await runLoop(pos[0] ?? need('project'), { first: flag('--first'), target: Number(val('--target') ?? 8), review: flag('--review'), format: val('--format') ?? null });
      process.exitCode = okAll ? 0 : 1;
      break;
    }
    case 'lint': {
      const rep = lintProject(pos[0] ?? need('project'));
      const bad = Object.entries(rep).flatMap(([i, h]) => h.map((x) => `scene ${i}: ${x}`));
      console.log(bad.length ? bad.join('\n') : 'clean');
      process.exitCode = bad.length ? 1 : 0;
      break;
    }
    case 'frame': {
      const name = pos[0] ?? need('project');
      const project = loadProject(name, { format: val('--format') ?? null });
      const si = sceneIn(project, pos[1] ?? need('scene'));
      const fr = int('frame', pos[2] ?? need('frame'));
      if (fr >= project.scenes[si].frames) { console.error(`scene ${si} has ${project.scenes[si].frames} frames (numbered from 0)`); process.exit(2); }
      const brand = loadBrand(project.dir);
      const dir = join(project.out, 'preview');
      await capture(project, brand, [si], { frames: [fr], outDir: dir, name: (s, f) => `scene-${si}-f${f}.png`, workers: 1, log: () => {} });
      console.log(join(dir, `scene-${si}-f${fr}.png`));
      break;
    }
    case 'sheet': {
      const name = pos[0] ?? need('project');
      const format = val('--format') ?? null;
      console.log(await sheet(name, sceneIn(loadProject(name, { format }), pos[1] ?? need('scene')), format));
      break;
    }
    case 'watch': {
      const name = pos[0] ?? need('project');
      const project = loadProject(name);
      const si = sceneIn(project, pos[1] ?? need('scene'));
      const file = project.scenes[si].file;
      const dir = join(project.dir, 'scenes');
      const make = async () => { try { console.log(`${new Date().toLocaleTimeString()}  ${await sheet(name, si, null)}`); } catch (e) { console.log(`error: ${e.message}`); } };
      await make();
      // A save that lands while a sheet is being made sets `dirty`, and the loop goes round again.
      let busy = false, dirty = false;
      fsWatch(dir, async (_ev, f) => {
        if (!f || !/\.(html|js|css)$/.test(f)) return;
        dirty = true;
        if (busy) return;
        busy = true;
        while (dirty) { dirty = false; await make(); }
        busy = false;
      });
      console.log(`watching ${dir} (scene ${si}: ${file.split('/').pop()}), ctrl-c to stop`);
      await new Promise(() => {});
      break;
    }
    case 'review': {
      const name = pos[0] ?? need('project');
      const project = loadProject(name, { format: val('--format') ?? null });
      if (flag('--mute')) {
        const brief = writeMuteBrief(project);
        console.log(`brief: ${brief}`);
        if (flag('--auto')) console.log(JSON.stringify(runMute(project, brief), null, 2));
        break;
      }
      const scores = scoreProject(project);
      const brief = writeBrief(project, scores);
      console.log(`brief: ${brief}`);
      if (flag('--auto')) console.log(JSON.stringify(runAuto(project, brief), null, 2));
      break;
    }
    case 'verify': {
      const project = loadProject(pos[0] ?? need('project'), { format: val('--format') ?? null });
      const m = verify(project, { hasReview: hasFullReview(project) });
      console.log(summary(m));
      console.log(`manifest: ${join(project.out, 'manifest.json')}`);
      process.exitCode = m.measured.every((c) => c.ok) ? 0 : 1;
      break;
    }
    case 'sfx': {
      // studio sfx            lists the library
      // studio sfx <name>     writes it to a wav in ./sfx-audition so you can hear it
      // studio sfx --all      writes every sound
      const dir = join(process.cwd(), 'sfx-audition');
      const names = flag('--all') ? SFX_NAMES : pos[0] ? [pos[0]] : null;
      if (!names) { console.log(SFX_NAMES.join('\n')); break; }
      for (const n of names) {
        const file = join(dir, `${n}.wav`);
        writeWav(file, renderSfx(n, n === 'type' ? { dur: 1.2, cps: 13 } : {}));
        console.log(file);
      }
      break;
    }
    case 'export': {
      const project = loadProject(pos[0] ?? need('project'), { format: val('--format') ?? null });
      const src = join(project.out, `${project.tag}.mp4`);
      if (!existsSync(src)) throw new Error(`render first: ${src} does not exist`);
      console.log(exportWeb(project, src));
      break;
    }
    case 'check':
      process.exitCode = (await determinism(pos[0] ?? need('project'), { format: val('--format') ?? null })) ? 0 : 1;
      break;
    case 'init':
    case 'new':
      console.log(scaffold(pos[0] ?? 'motion'));
      break;
    case 'doctor':
      await doctor();
      break;
    case 'list': {
      const found = new Set();
      for (const base of [process.cwd(), join(process.cwd(), 'motion')]) {
        if (!existsSync(base)) continue;
        if (existsSync(join(base, 'project.json'))) found.add(base);
        for (const p of readdirSync(base)) if (existsSync(join(base, p, 'project.json'))) found.add(join(base, p));
      }
      for (const f of found) console.log(f);
      break;
    }
    default:
      console.log(HELP);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
