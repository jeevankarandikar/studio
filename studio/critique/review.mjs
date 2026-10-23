// Visual review by a fresh-context model. It sees only images, the brand notes and a rubric, never the scene
// code or why anything was built that way. Its scores can only lower a mechanical score.
//
//   studio review <project>            writes out/<tag>/review-brief.md for any reviewer (a human, a subagent)
//   studio review <project> --auto     also runs `claude -p` on that brief and writes out/<tag>/review.json
//   studio review <project> --mute     the mute test: a judge sees the film with no sound and says what it understood
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT } from '../project.mjs';
import { cutStrips, motionStrips, filmSheet, frameDeltas } from './score.mjs';

function fontFamilies(project) {
  const f = join(project.dir, 'brand/fonts/fonts.json');
  if (!existsSync(f)) return 'see brand pack';
  return [...new Set(Object.values(JSON.parse(readFileSync(f, 'utf8'))).map((m) => m.family))].join(', ');
}

export function writeBrief(project, scores) {
  const rubric = readFileSync(join(ROOT, 'studio/critique/rubric.md'), 'utf8');
  const colors = existsSync(join(project.dir, 'brand/colors.json')) ? readFileSync(join(project.dir, 'brand/colors.json'), 'utf8') : '{}';
  const deltas = frameDeltas(project);
  const cuts = cutStrips(project);
  const peaks = motionStrips(project, deltas);
  const brief = [
    `# Review brief: ${project.name}`,
    '',
    `Format ${project.width}x${project.height}, ${project.seconds}s, ${project.scenes.length} scenes.`,
    `Brand palette: ${colors.replace(/\s+/g, ' ')}`,
    `Brand type: ${fontFamilies(project)}. Layouts are left-aligned unless the brand says otherwise.`,
    '',
    '## Contact sheets (8 spread-out frames per scene; read each image file)',
    ...scores.map((s) => `- scene ${s.scene}: ${s.sheet}`),
    '',
    '## Cut strips (10 consecutive frames: 5 before the cut and 5 after; read each image file)',
    ...cuts.map((c) => `- cut into scene ${c.cut}: ${c.file}`),
    '',
    '## Peak-motion strips (10 consecutive frames at the fastest moment of each scene)',
    ...peaks.map((p) => `- scene ${p.scene}: ${p.file}`),
    '',
    rubric,
  ].join('\n');
  const file = join(project.out, 'review-brief.md');
  writeFileSync(file, brief);
  return file;
}

// The mute test. The judge is told nothing about what the film is for beyond its name.
export function writeMuteBrief(project) {
  const sheet = filmSheet(project);
  const brief = [
    `# Mute test: ${project.name}`,
    '',
    'You are watching a short film with the sound off. You see 12 frames spread evenly from start to finish, left to right, top to bottom, in this one image:',
    '',
    sheet,
    '',
    'Answer from the pictures and on-screen words only. Do not guess at what you cannot see.',
    '',
    'Reply with a single JSON object and nothing else:',
    '',
    '{"about": "one sentence on what this film is about", "ask": "what it wants the viewer to do or remember, or null if it never says", "unclear": ["each thing you could not follow or had to guess at, naming the frame"], "clear": true}',
    '',
    'Set "clear" to false if you could not state what it is about, or what it wants, without guessing.',
  ].join('\n');
  const file = join(project.out, 'mute-brief.md');
  writeFileSync(file, brief);
  return file;
}

// The reviewer works in a fresh temporary folder that holds only the brief and the images it names. Run from the
// project, it could read the scene code, project.json and the manifest, and would no longer be a fresh judge.
function claude(promptFor, project, briefFile) {
  const dir = mkdtempSync(join(tmpdir(), 'studio-review-'));
  try {
    let text = readFileSync(briefFile, 'utf8');
    const seen = new Map();
    for (const m of text.matchAll(/\/[^\s`"']+\.jpg/g)) {
      if (seen.has(m[0]) || !existsSync(m[0])) continue;
      const name = `img-${seen.size}-${basename(m[0])}`;
      copyFileSync(m[0], join(dir, name));
      seen.set(m[0], join(dir, name));
    }
    for (const [from, to] of seen) text = text.split(from).join(to);
    const staged = join(dir, 'brief.md');
    writeFileSync(staged, text);
    const r = spawnSync('claude', ['-p', promptFor(staged), '--model', 'opus', '--allowedTools', 'Read', '--add-dir', dir], { encoding: 'utf8', maxBuffer: 1 << 24, cwd: dir });
    if (r.error || r.status !== 0) throw new Error(`claude -p failed: ${r.error?.message ?? r.stderr?.split('\n')[0] ?? r.status}`);
    const m = r.stdout.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('reviewer returned no JSON:\n' + r.stdout.slice(0, 400));
    return JSON.parse(m[0]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function runAuto(project, briefFile) {
  const review = claude((b) => `Read ${b}, then read each image file it lists. Follow the rubric in it exactly and reply with only the JSON object it asks for.`, project, briefFile);
  for (const [k, v] of Object.entries(review)) {
    if (typeof v?.score !== 'number') throw new Error(`reviewer gave scene ${k} no numeric score`);
  }
  writeFileSync(join(project.out, 'review.json'), JSON.stringify(review, null, 2) + '\n');
  return review;
}

export function runMute(project, briefFile) {
  const r = claude((b) => `Read ${b}, then read the image file it names. Follow it exactly and reply with only the JSON object it asks for.`, project, briefFile);
  writeFileSync(join(project.out, 'mute.json'), JSON.stringify(r, null, 2) + '\n');
  return r;
}
