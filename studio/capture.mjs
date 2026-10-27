import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cpus } from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT } from './project.mjs';
import { validateEvent } from './audio/sfx.mjs';

const spring = readFileSync(join(ROOT, 'studio/spring.js'), 'utf8');
const runtime = readFileSync(join(ROOT, 'studio/runtime.js'), 'utf8');
// Flags used by frame-capture tools to make Chrome draw every frame completely and in the same way:
// finish all compositor stages before a draw, never time out waiting for new content, keep animation, scrolling and
// image decoding on the main thread, and do not resync image animations.
const ARGS = [
  '--force-color-profile=srgb', '--font-render-hinting=none',
  '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
  '--disable-threaded-animation', '--disable-threaded-scrolling',
  '--disable-checker-imaging', '--disable-image-animation-resync',
];

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

// Seek, then wait for two paint cycles so lazy work (SVG and image re-rasterizing at the new scale, layout)
// is done before the screenshot. The timeout keeps a page that is not being painted from hanging the render.
async function seekAndSettle(page, frame, project, offset) {
  await page.evaluate(async ([fr, fps, b, off]) => {
    window.__seek(fr, fps, b, off);
    await Promise.race([
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      new Promise((r) => setTimeout(r, 250)),
    ]);
  }, [frame, project.fps, project.beatSec, offset]);
}

async function openScene(ctx, project, brand, s) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(s.file).href);
  await page.addStyleTag({ content: brand.css });
  // will-change puts an element on its own compositor layer, and Chrome re-rasterizes such a layer lazily when its
  // scale changes. Which version a screenshot catches varies between runs, so it is switched off for capture.
  await page.addStyleTag({ content: '*,*::before,*::after{will-change:auto!important;}' });
  await page.evaluate(([c, fmt]) => { window.__captions = c; window.__format = fmt; }, [project.captions, project.format ? { name: project.format, w: project.width, h: project.height } : null]);
  const native = await page.evaluate(() => !!window.scene?.native);
  if (project.format && !native) await page.addStyleTag({ content: fitCss(project) });
  // Font faces load lazily; force every one to load, then wait for images, so no frame is drawn with a fallback font.
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
  });
  // Warm-up: the first paint of a fresh page can differ from later ones. Draw once and discard.
  await seekAndSettle(page, 0, project, s.start);
  await page.screenshot({ type: 'jpeg', quality: 10 });
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
    if (outDir === project.framesDir) writeFileSync(join(outDir, 'browser.json'), JSON.stringify({ browser: browser.version() }));
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
        // A scene declares its own sound events in window.scene.sfx, in seconds from the scene start,
        // from the same constants that place the visuals. Saved once per scene for the mixer.
        if (k === 0 && !frames && outDir === project.framesDir) {
          const raw = await page.evaluate(() => {
            const s = window.scene?.sfx;
            return s === undefined ? [] : Array.isArray(s) ? s.map((e) => ({ ...e })) : { notArray: typeof s };
          });
          if (!Array.isArray(raw)) throw new Error(`scene ${i} (${s.file.split('/').pop()}): window.scene.sfx must be an array, got ${raw.notArray}`);
          raw.forEach((e, k) => validateEvent(e, `scene ${i} (${s.file.split('/').pop()}) sfx[${k}]`, s.frames / project.fps));
          writeFileSync(join(outDir, `sfx-${i}.json`), JSON.stringify(raw));
        }
        for (const f of mine) {
          await seekAndSettle(page, f, project, s.start);
          if (errors.length) throw new Error(`scene ${i} page error: ${errors[0]}`);
          const file = name ? name(s, f) : `${String(s.start + f + 1).padStart(5, '0')}.${type}`;
          await page.screenshot({ path: join(outDir, file), type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
        }
        await page.close();
      }));
      // Every frame must exist and be non-empty before the scene counts as done.
      const missing = list.filter((f) => {
        const p = join(outDir, name ? name(s, f) : `${String(s.start + f + 1).padStart(5, '0')}.${type}`);
        try { return statSync(p).size === 0; } catch { return true; }
      });
      if (missing.length) throw new Error(`scene ${i}: ${missing.length} of ${list.length} frames were not written (first missing: frame ${missing[0]}) in ${outDir}`);
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
    await seekAndSettle(page, frame, project, s.start);
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}
