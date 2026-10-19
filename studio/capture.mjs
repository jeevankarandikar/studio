import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cpus } from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT } from './project.mjs';

const spring = readFileSync(join(ROOT, 'studio/spring.js'), 'utf8');
const runtime = readFileSync(join(ROOT, 'studio/runtime.js'), 'utf8');
const ARGS = ['--force-color-profile=srgb', '--font-render-hinting=none'];

export async function launch() {
  let first;
  try {
    return await chromium.launch({ args: ARGS });
  } catch (e) {
    first = e;
  }
  // Bundled Chromium is optional; fall back to the Chrome already on the machine.
  try {
    return await chromium.launch({ channel: 'chrome', args: ARGS });
  } catch (e) {
    const err = new Error(`could not start a browser.\nbundled: ${firstLine(first)}\nchrome: ${firstLine(e)}\nrun "studio doctor" for a diagnosis`);
    err.cause = first;
    throw err;
  }
}

const firstLine = (e) => String(e.message).split('\n').find((l) => /err|denied|not permitted|executable/i.test(l)) ?? String(e.message).split('\n')[0];

// Scenes written for the base size are scaled into other formats unless they opt in with scene.native.
function fitCss(project) {
  const [bw, bh] = project.baseSize;
  const s = Math.min(project.width / bw, project.height / bh);
  const vw = project.width / s, vh = project.height / s;
  return `html{zoom:${s};width:${vw}px!important;height:${vh}px!important;background:var(--paper,#fff)!important;}
body{position:absolute!important;left:${(vw - bw) / 2}px;top:${(vh - bh) / 2}px;width:${bw}px!important;height:${bh}px!important;}`;
}

async function openScene(ctx, project, brand, s) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(s.file).href);
  await page.addStyleTag({ content: brand.css });
  await page.evaluate(([c, fmt]) => { window.__captions = c; window.__format = fmt; }, [project.captions, project.format ? { name: project.format, w: project.width, h: project.height } : null]);
  const native = await page.evaluate(() => !!window.scene?.native);
  if (project.format && !native) await page.addStyleTag({ content: fitCss(project) });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode().catch(() => {}))));
  return { page, errors };
}

// Captures frames of the given scenes. Frames of one scene are split into contiguous chunks across
// `workers` pages of a single browser.
//   frames: optional list of local frame numbers to capture (default all)
//   name(s, f): file name for scene s, local frame f (default global %05d.png)
//   outDir: where files go (default project.framesDir)
export async function capture(project, brand, sceneIndexes, { workers = Math.min(4, Math.max(1, cpus().length - 1)), frames = null, outDir = project.framesDir, name = null, type = 'png', log = console.log } = {}) {
  mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: project.width, height: project.height }, deviceScaleFactor: 1 });
    await ctx.addInitScript(spring);
    await ctx.addInitScript(runtime);
    for (const i of sceneIndexes) {
      const s = project.scenes[i];
      const list = frames ?? Array.from({ length: s.frames }, (_, f) => f);
      const w = Math.max(1, Math.min(workers, list.length));
      const chunk = Math.ceil(list.length / w);
      await Promise.all(Array.from({ length: w }, async (_, k) => {
        const mine = list.slice(k * chunk, (k + 1) * chunk);
        if (!mine.length) return;
        const { page, errors } = await openScene(ctx, project, brand, s);
        for (const f of mine) {
          await page.evaluate(([fr, fps, b, off]) => window.__seek(fr, fps, b, off), [f, project.fps, project.beatSec, s.start]);
          if (errors.length) throw new Error(`scene ${i} page error: ${errors[0]}`);
          const file = name ? name(s, f) : `${String(s.start + f + 1).padStart(5, '0')}.${type}`;
          await page.screenshot({ path: join(outDir, file), type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
        }
        await page.close();
      }));
      log(`scene ${i} ${s.file.split('/').pop()}: ${list.length} frames`);
    }
  } finally {
    await browser.close();
  }
}

// Renders one frame to a Buffer, for determinism checks.
export async function frameBuffer(project, brand, sceneIndex, frame) {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: project.width, height: project.height }, deviceScaleFactor: 1 });
    await ctx.addInitScript(spring);
    await ctx.addInitScript(runtime);
    const s = project.scenes[sceneIndex];
    const { page } = await openScene(ctx, project, brand, s);
    await page.evaluate(([fr, fps, b, off]) => window.__seek(fr, fps, b, off), [frame, project.fps, project.beatSec, s.start]);
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}
