import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateEvent } from './audio/sfx.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Loads project.json and derives frame counts. Durations are given in beats, so with
// bpm 120 and fps 30 every beat is 15 whole frames and every cut lands on a beat.
//
// project.json fields: bpm, fps, size [w,h], scenes [{file, beats, needs?}],
// formats {name: [w,h]} (optional extra aspect ratios), captions [{beat, beats, text}],
// voiceover "file.wav" (optional, mixed under the music), job (optional: one of
// Storytelling, Relatable, Opinion, Advice — what the film is for, not what it is about).
export const JOBS = ['Storytelling', 'Relatable', 'Opinion', 'Advice'];
export function resolveProjectDir(ref) {
  // A project is any directory with a project.json, inside any repo. A bare name also falls back to
  // ./motion/<name> in the current directory and to projects/<name> inside this tool's own folder.
  const tries = [resolve(ref), resolve('motion', ref), join(ROOT, 'projects', ref)];
  const hit = tries.find((d) => existsSync(join(d, 'project.json')));
  if (!hit) throw new Error(`no project.json found for "${ref}" (looked in ${tries.join(', ')})`);
  return hit;
}

export function loadProject(ref, { format = null } = {}) {
  const dir = resolveProjectDir(ref);
  const name = dir.split('/').filter(Boolean).pop();
  const cfg = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
  if (cfg.job !== undefined && !JOBS.includes(cfg.job)) throw new Error(`project.json job "${cfg.job}" unknown (want ${JOBS.join(', ')})`);
  const fps = cfg.fps ?? 30;
  const beatSec = 60 / cfg.bpm;
  const beatFrames = fps * beatSec;
  const base = cfg.size ?? [1920, 1080];
  let size = base;
  if (format) {
    if (!cfg.formats?.[format]) throw new Error(`format "${format}" not in project.json formats (${Object.keys(cfg.formats ?? {}).join(', ') || 'none'})`);
    size = cfg.formats[format];
  }
  let start = 0;
  const scenes = cfg.scenes.map((s, i) => {
    const frames = Math.round(s.beats * beatFrames);
    const exact = (s.beats * fps * 60) / cfg.bpm; // exact frames, before rounding; avoids float error in fps * (60 / bpm)
    const out = { ...s, index: i, file: join(dir, 'scenes', s.file), start, frames, onBeat: Math.abs(exact - Math.round(exact)) < 1e-6 };
    start += frames;
    return out;
  });
  const tag = format ? `${name}-${format}` : name;
  return {
    name, dir, fps, bpm: cfg.bpm, beatSec, beatFrames,
    format, baseSize: base, width: size[0], height: size[1],
    scenes, totalFrames: start, seconds: start / fps,
    captions: cfg.captions ?? [],
    // Optional format job (Storytelling, Relatable, Opinion, Advice). Pure metadata:
    // nothing renders differently when it is absent or present.
    job: cfg.job ?? null,
    // project-level sound effects placed by beat, and an optional effect on every cut (e.g. "whoosh")
    sfx: (cfg.sfx ?? []).map((e, k) => {
      const t = e.t ?? (typeof e.beat === 'number' ? e.beat * beatSec : undefined);
      validateEvent({ ...e, t }, `project.json sfx[${k}]`, start / fps);
      return { ...e, t, where: `project.json sfx[${k}]` };
    }),
    cutSfx: cfg.cutSfx ?? null,
    voiceover: cfg.voiceover ? join(dir, cfg.voiceover) : null,
    formats: cfg.formats ?? {},
    // Output lives inside the project, so every repo keeps its own renders. `studio init` gitignores both.
    tag, out: join(dir, 'out', tag), framesDir: join(dir, '.frames', tag),
  };
}

// A scene may declare files it cannot render without, such as real product screenshots.
export function missingAssets(project) {
  const miss = [];
  for (const s of project.scenes) {
    for (const need of s.needs ?? []) {
      if (!existsSync(join(project.dir, need))) miss.push(`scene ${s.index} (${s.file.split('/').pop()}) needs ${need}`);
    }
  }
  return miss;
}

// Brand lock. Refuses to render until fonts, palette, logo and 2+ reference frames load.
export function loadBrand(dir) {
  const b = join(dir, 'brand');
  const problems = [];
  const need = (p, why) => { if (!existsSync(join(b, p))) problems.push(`${p}: ${why}`); };
  need('colors.json', 'palette missing');
  const fontDir = join(b, 'fonts');
  const fonts = existsSync(fontDir) ? readdirSync(fontDir).filter((f) => /\.(woff2?|ttf|otf)$/i.test(f)) : [];
  if (!fonts.length) problems.push('fonts/: no font files');
  const logo = existsSync(b) ? readdirSync(b).find((f) => /^logo\.(svg|png)$/i.test(f)) : null;
  if (!logo) problems.push('logo.svg or logo.png missing');
  const refDir = join(b, 'refs');
  const refs = existsSync(refDir) ? readdirSync(refDir).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
  if (refs.length < 2) problems.push(`refs/: need 2+ reference frames, found ${refs.length}`);
  if (problems.length) throw new Error(`brand pack incomplete for ${dir}\n  ` + problems.join('\n  '));

  const colors = JSON.parse(readFileSync(join(b, 'colors.json'), 'utf8'));
  const fontMeta = existsSync(join(fontDir, 'fonts.json')) ? JSON.parse(readFileSync(join(fontDir, 'fonts.json'), 'utf8')) : {};
  const faces = fonts.map((f) => {
    const m = fontMeta[f] ?? {};
    return `@font-face{font-family:"${m.family ?? f.replace(/\.[^.]+$/, '')}";font-weight:${m.weight ?? 400};font-style:${m.style ?? 'normal'};src:url("${pathToFileURL(join(fontDir, f)).href}");}`;
  });
  // --display is the first non-mono family, --mono the first family whose name says mono or code.
  const families = [...new Set(fonts.map((f) => fontMeta[f]?.family ?? f.replace(/\.[^.]+$/, '')))];
  const mono = families.find((n) => /mono|code/i.test(n));
  const display = families.find((n) => n !== mono) ?? families[0];
  const fontVars = `--display:"${display}",Georgia,serif;${mono ? `--mono:"${mono}",ui-monospace,monospace;` : ''}`;
  const vars = Object.entries(colors).map(([k, v]) => `--${k}:${v};`).join('') + fontVars;
  const logoUrl = pathToFileURL(join(b, logo)).href;
  const css = `${faces.join('\n')}\n:root{${vars}--logo:url("${logoUrl}");}`;
  return { css, colors, logoUrl, fonts, refs: refs.map((r) => join(refDir, r)) };
}
