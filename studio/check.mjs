// Determinism check: the same frame rendered in two fresh browsers must be byte-identical.
import { createHash } from 'node:crypto';
import { loadProject, loadBrand } from './project.mjs';
import { frameBuffer } from './capture.mjs';

export async function determinism(name, { format = null, samples = 3 } = {}) {
  const project = loadProject(name, { format });
  const brand = loadBrand(project.dir);
  const picks = [];
  for (let i = 0; i < samples; i++) {
    const s = project.scenes[Math.floor((i * project.scenes.length) / samples)];
    picks.push([s.index, Math.floor(s.frames * (0.3 + 0.2 * i))]);
  }
  let fail = 0;
  for (const [si, f] of picks) {
    const a = createHash('sha256').update(await frameBuffer(project, brand, si, f)).digest('hex');
    const b = createHash('sha256').update(await frameBuffer(project, brand, si, f)).digest('hex');
    console.log(`${a === b ? 'same ' : 'DIFF '} scene ${si} frame ${f}  ${a.slice(0, 12)} ${b.slice(0, 12)}`);
    if (a !== b) fail++;
  }
  console.log(fail ? `${fail} frame(s) differ: something in a scene reads the clock, randomness or network` : 'deterministic');
  return fail === 0;
}
