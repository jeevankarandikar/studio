// Visual review by a fresh-context model. It sees only the contact sheets, the brand notes and the rubric,
// never the scene code or why anything was built that way. Its scores can only lower a mechanical score.
//
//   studio review <project>            writes out/<tag>/review-brief.md for any reviewer (a human, a subagent)
//   studio review <project> --auto     also runs `claude -p` on that brief and writes out/<tag>/review.json
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../project.mjs';

function fontFamilies(project) {
  const f = join(project.dir, 'brand/fonts/fonts.json');
  if (!existsSync(f)) return 'see brand pack';
  return [...new Set(Object.values(JSON.parse(readFileSync(f, 'utf8'))).map((m) => m.family))].join(', ');
}

export function writeBrief(project, scores) {
  const rubric = readFileSync(join(ROOT, 'studio/critique/rubric.md'), 'utf8');
  const colors = existsSync(join(project.dir, 'brand/colors.json')) ? readFileSync(join(project.dir, 'brand/colors.json'), 'utf8') : '{}';
  const brief = [
    `# Review brief: ${project.name}`,
    '',
    `Format ${project.width}x${project.height}, ${project.seconds}s, ${project.scenes.length} scenes.`,
    `Brand palette: ${colors.replace(/\s+/g, ' ')}`,
    `Brand type: ${fontFamilies(project)}. Layouts are left-aligned unless the brand says otherwise.`,
    '',
    '## Contact sheets (read each image file, one per scene)',
    ...scores.map((s) => `- scene ${s.scene}: ${s.sheet}`),
    '',
    rubric,
  ].join('\n');
  const file = join(project.out, 'review-brief.md');
  writeFileSync(file, brief);
  return file;
}

export function runAuto(project, briefFile) {
  const prompt = `Read ${briefFile}, then read each contact sheet image it lists. Follow the rubric in it exactly and reply with only the JSON object it asks for.`;
  const r = spawnSync('claude', ['-p', prompt, '--model', 'opus', '--allowedTools', 'Read', '--add-dir', project.out], { encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.error || r.status !== 0) throw new Error(`claude -p failed: ${r.error?.message ?? r.stderr?.split('\n')[0] ?? r.status}`);
  const m = r.stdout.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('reviewer returned no JSON:\n' + r.stdout.slice(0, 400));
  const review = JSON.parse(m[0]);
  for (const [k, v] of Object.entries(review)) {
    if (typeof v?.score !== 'number') throw new Error(`reviewer gave scene ${k} no numeric score`);
  }
  writeFileSync(join(project.out, 'review.json'), JSON.stringify(review, null, 2) + '\n');
  return review;
}
