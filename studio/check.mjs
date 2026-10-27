// Determinism check: the same frame rendered in fresh browsers must be byte-identical.
// For each sampled frame it renders `runs` times. When they differ it saves the frames and measures how much.
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProject, loadBrand } from './project.mjs';
import { frameBuffer } from './capture.mjs';

// How different two PNGs are: the largest and mean per-channel difference, from ffmpeg's difference blend.
function measure(fileA, fileB) {
  const r = spawnSync('ffmpeg', ['-nostats', '-hide_banner', '-i', fileA, '-i', fileB, '-filter_complex', 'blend=all_mode=difference,format=gray,signalstats,metadata=print:file=-', '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  const g = (k) => Number((r.stdout.match(new RegExp(`${k}=([\\d.]+)`)) ?? [])[1]);
  return { max: g('YMAX'), mean: g('YAVG') };
}

export async function determinism(ref, { format = null, samples = 3, runs = 2 } = {}) {
  const project = loadProject(ref, { format });
  const brand = loadBrand(project.dir);
  const picks = [];
  for (let i = 0; i < samples; i++) {
    const s = project.scenes[Math.floor((i * project.scenes.length) / samples)];
    picks.push([s.index, Math.floor(s.frames * (0.3 + 0.2 * i))]);
  }
  const dir = join(project.out, 'check');
  let fail = 0;
  for (const [si, f] of picks) {
    const shots = [];
    for (let k = 0; k < runs; k++) shots.push(await frameBuffer(project, brand, si, f));
    const hashes = shots.map((b) => createHash('sha256').update(b).digest('hex').slice(0, 12));
    const same = hashes.every((h) => h === hashes[0]);
    console.log(`${same ? 'same ' : 'DIFF '} scene ${si} frame ${f}  ${hashes.join(' ')}`);
    if (!same) {
      fail++;
      mkdirSync(dir, { recursive: true });
      const files = shots.map((b, k) => { const p = join(dir, `scene-${si}-f${f}-run${k}.png`); writeFileSync(p, b); return p; });
      const odd = hashes.findIndex((h) => h !== hashes[0]);
      const d = measure(files[0], files[odd]);
      console.log(`      largest pixel difference ${d.max} of 255, mean ${d.mean}; frames saved in ${dir}`);
    }
  }
  console.log(fail ? `${fail} frame(s) differ between runs` : 'deterministic');
  return fail === 0;
}
