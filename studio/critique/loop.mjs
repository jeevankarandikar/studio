// One iteration of the critique loop: render (all scenes on first, otherwise only scenes that scored under
// target), score every scene, optionally ask a fresh-context reviewer, write out/<tag>/report.json.
// Returns true when every scene is at target or better. Between iterations the builder edits weak scenes.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject } from '../project.mjs';
import { render } from '../render.mjs';
import { scoreProject } from './score.mjs';
import { writeBrief, runAuto } from './review.mjs';

export async function runLoop(name, { first = false, target = 8, format = null, review = false, workers } = {}) {
  const project = loadProject(name, { format });
  const reportFile = join(project.out, 'report.json');
  let scenes = null;
  if (!first && existsSync(reportFile)) {
    scenes = JSON.parse(readFileSync(reportFile, 'utf8')).scores.filter((s) => s.score < target).map((s) => s.scene);
    if (!scenes.length) { console.log('nothing below target'); return true; }
  }
  console.log(scenes ? `re-rendering scenes ${scenes}` : 'rendering all scenes');
  await render(name, { scenes, format, workers });

  let scores = scoreProject(project);
  if (review) {
    const brief = writeBrief(project, scores);
    try {
      runAuto(project, brief);
      scores = scoreProject(project); // picks up review.json
    } catch (e) {
      console.log(`review skipped: ${e.message}\nbrief for any reviewer: ${brief}`);
    }
  }
  writeFileSync(reportFile, JSON.stringify({ target, scores }, null, 2));
  for (const s of scores) {
    console.log(`scene ${s.scene} ${s.file.padEnd(24)} ${String(s.score).padStart(4)}  motion ${s.motion}  ${s.notes.join('; ')}`);
  }
  const weak = scores.filter((s) => s.score < target);
  console.log(weak.length ? `${weak.length} scene(s) under ${target}: ${weak.map((s) => s.scene)}` : `all scenes at ${target}+`);
  return weak.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const name = args[0];
  if (!name) { console.error('usage: loop.mjs <project> [--first] [--target 8] [--review] [--format name]'); process.exit(2); }
  const val = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  runLoop(name, { first: args.includes('--first'), target: Number(val('--target') ?? 8), review: args.includes('--review'), format: val('--format') ?? null })
    .then((okAll) => process.exit(okAll ? 0 : 1))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
