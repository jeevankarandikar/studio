// studio init [dir]  (default ./motion)
// Sets up a video project inside the repo you are standing in and looks around the repo for a logo,
// fonts, colors and reference images so the brand pack starts filled in. It reports what it found
// and what is still missing; nothing is invented.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, copyFileSync } from 'node:fs';
import { join, basename, extname, resolve, relative } from 'node:path';
import { ROOT } from './project.mjs';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'out', '.frames', 'target', 'vendor', '.venv', 'venv', '__pycache__', 'Pods', 'DerivedData', 'motion']);

// Regular files only: symlinks are not followed (a link to ~ or a cycle would walk forever), and a
// repo with more than MAX_ENTRIES files is read only up to that many.
const MAX_ENTRIES = 50_000;
function walk(dir, depth, visit, budget = { n: 0 }) {
  if (depth < 0 || budget.n > MAX_ENTRIES) return;
  let names;
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (SKIP.has(n) || (n.startsWith('.') && n !== '.design-refs')) continue;
    const p = join(dir, n);
    let st;
    try { st = lstatSync(p); } catch { continue; }
    if (++budget.n > MAX_ENTRIES) return;
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(p, depth - 1, visit, budget);
    else if (st.isFile()) visit(p, st);
  }
}

const tryRead = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };
const skipped = [];
function safeCopy(from, to) {
  try { copyFileSync(from, to); return true; } catch { skipped.push(from); return false; }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsStr = (s) => JSON.stringify(String(s)).replace(/</g, '\\u003c');

const hexRe = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;
function norm(h) { return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; }
const luminance = (h) => { const n = parseInt(norm(h).slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

export function discover(repo) {
  const files = [];
  walk(repo, 5, (p, st) => files.push([p, st.size]));

  const rank = (p) => (/brand|logo|assets|public|static|icon/i.test(p) ? 0 : 1) + (/dark|small|16|32|favicon/i.test(basename(p)) ? 2 : 0);
  const logos = files.filter(([p]) => /(^|[-_./])(logo|mark|wordmark|icon)[^/]*\.(svg|png)$/i.test(p) && !/node_modules/.test(p))
    .sort((a, b) => rank(a[0]) - rank(b[0]) || (extname(a[0]) === '.svg' ? -1 : 1));
  const logo = logos[0]?.[0] ?? files.find(([p]) => /favicon\.svg$/i.test(p))?.[0] ?? null;

  const fonts = files.filter(([p]) => /\.(woff2?|ttf|otf)$/i.test(p)).slice(0, 8).map(([p]) => p);

  const css = files.filter(([p, s]) => /\.(css|scss)$/i.test(p) && s < 500_000).map(([p]) => p);
  const vars = {};
  const counts = {};
  for (const f of css) {
    const text = tryRead(f);
    if (text === null) continue;
    for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) if (!(m[1] in vars)) vars[m[1]] = norm(m[2]);
    for (const m of text.matchAll(new RegExp(hexRe, 'g'))) counts[norm(m[0])] = (counts[norm(m[0])] ?? 0) + 1;
  }
  const pick = (re) => Object.entries(vars).find(([k]) => re.test(k))?.[1];
  const palette = {
    // Match whole words only: "foreground" must never count as a background.
    paper: pick(/^(bg|background|paper|surface|ground|canvas)$/) ?? pick(/(^|-)(bg|background|paper|surface|canvas)$/),
    ink: pick(/^(fg|foreground|ink|text|on-surface)$/) ?? pick(/(^|-)(fg|foreground|ink|text)$/),
    accent: pick(/^(accent|primary|brand|a)$/) ?? pick(/(^|-)(accent|primary|brand)$/),
  };
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const light = common.find((h) => luminance(h) > 0.85), dark = common.find((h) => luminance(h) < 0.2);
  palette.paper ??= light ?? null;
  palette.ink ??= dark ?? null;
  palette.accent ??= common.find((h) => luminance(h) > 0.2 && luminance(h) < 0.8) ?? null;

  // The word must start at a boundary, so "logo.png", "blog-card.jpg" and "dialog.png" do not count as "og".
  const refs = files.filter(([p, s]) => /(^|[-_./])(og|opengraph|social|screenshot|hero|banner|preview|cover)([-_.][^/]*)?\.(png|jpe?g)$/i.test(p) && s < 6_000_000).slice(0, 3).map(([p]) => p);
  const shots = files.filter(([p, s]) => /screenshot|screen-?shot|\/shots?\//i.test(p) && /\.(png|jpe?g)$/i.test(p) && s < 6_000_000).slice(0, 4).map(([p]) => p);

  let pkg = {};
  try { pkg = JSON.parse(tryRead(join(repo, 'package.json')) ?? '{}'); } catch { /* not a node repo */ }
  let readmeTitle = null;
  for (const n of ['README.md', 'readme.md']) if (existsSync(join(repo, n))) readmeTitle = (tryRead(join(repo, n)) ?? '').match(/^#\s+([^<\n]+)$/m)?.[1]?.trim() ?? null;
  const name = (pkg.name ?? readmeTitle ?? basename(repo)).replace(/^@[^/]+\//, '');
  const tagline = pkg.description ?? 'Say what it does in one line.';
  return { logo, fonts, palette, refs, shots, name, tagline };
}

const fill = (s, v) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? `{{${k}}}`);
const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function scaffold(dirArg = 'motion', { repo = process.cwd() } = {}) {
  const dir = resolve(repo, dirArg);
  if (existsSync(join(dir, 'project.json'))) throw new Error(`${dir} already has a project.json`);
  const d = discover(repo);
  const log = [];
  for (const sub of ['brand/fonts', 'brand/refs', 'brand/shots', 'scenes']) mkdirSync(join(dir, sub), { recursive: true });

  // brand pack
  let logoFile = 'logo.svg';
  if (d.logo && safeCopy(d.logo, join(dir, 'brand', 'logo' + extname(d.logo).toLowerCase()))) { logoFile = 'logo' + extname(d.logo).toLowerCase(); log.push(`logo     ${relative(repo, d.logo)}`); }
  else log.push('logo     NOT FOUND: put brand/logo.svg or brand/logo.png in place');

  const meta = {};
  for (const f of d.fonts) {
    const file = basename(f);
    if (!safeCopy(f, join(dir, 'brand/fonts', file))) continue;
    const stem = file.replace(/\.[^.]+$/, '');
    const weight = /bold/i.test(stem) ? 700 : /medium/i.test(stem) ? 500 : /light/i.test(stem) ? 300 : 400;
    meta[file] = { family: titleCase(stem.replace(/[-_ ]?(regular|bold|medium|light|italic|latin|variable|\d{3})\b/gi, '')).trim() || titleCase(stem), weight };
  }
  writeFileSync(join(dir, 'brand/fonts/fonts.json'), JSON.stringify(meta, null, 2) + '\n');
  log.push(d.fonts.length ? `fonts    ${d.fonts.length} found; check brand/fonts/fonts.json for family and weight` : 'fonts    NOT FOUND: add .woff2 files to brand/fonts/ (the render refuses to run without one)');

  const p = d.palette;
  const colors = { paper: p.paper ?? '#ffffff', ink: p.ink ?? '#111111', accent: p.accent ?? '#555555', muted: '#666666', card: '#ffffff', rule: 'rgba(0,0,0,0.16)' };
  writeFileSync(join(dir, 'brand/colors.json'), JSON.stringify(colors, null, 2) + '\n');
  log.push(`colors   paper ${p.paper ?? '(default)'}, ink ${p.ink ?? '(default)'}, accent ${p.accent ?? '(default)'}${p.paper && p.ink && p.accent ? '' : ': edit brand/colors.json'}`);

  const refs = d.refs.filter((r, i) => safeCopy(r, join(dir, 'brand/refs', `ref-${i + 1}${extname(r).toLowerCase()}`)));
  log.push(refs.length >= 2 ? `refs     ${refs.length} found` : `refs     ${refs.length} found, need 2 or more in brand/refs/ (screenshots of the product or site at its best)`);
  const shots = d.shots.filter((r, i) => safeCopy(r, join(dir, 'brand/shots', `shot-${i + 1}${extname(r).toLowerCase()}`)));
  if (shots.length) log.push(`shots    ${shots.length} candidate screenshots copied to brand/shots/`);
  d.shots = shots;
  if (skipped.length) log.push(`skipped  ${skipped.length} unreadable file(s): ${skipped.map((s) => relative(repo, s)).join(', ')}`);

  // scenes. Repo text goes into HTML escaped, and into script strings as JSON.
  const title = titleCase(d.name);
  const v = {
    LOGO: logoFile, NAME: esc(title), TAGLINE: esc(d.tagline), CTA: esc(d.name.includes('.') ? d.name : title),
    CTA_SUB: 'Say where to get it.', HEADLINE: 'Show the thing itself.',
    SHOT: d.shots.length ? 'shot-1' + extname(d.shots[0]).toLowerCase() : 'shot-1.png', SHOT_TITLE_JS: jsStr(title),
  };
  copyFileSync(join(ROOT, 'kit/common.js'), join(dir, 'scenes/common.js'));
  copyFileSync(join(ROOT, 'kit/common.css'), join(dir, 'scenes/common.css'));
  const plan = [{ t: 'title.html', out: '00-title.html' }];
  if (d.shots.length) plan.push({ t: 'shot.html', out: '01-shot.html', needs: [`brand/shots/${v.SHOT}`] });
  plan.push({ t: 'close.html', out: `${String(plan.length).padStart(2, '0')}-close.html` });
  for (const s of plan) writeFileSync(join(dir, 'scenes', s.out), fill(readFileSync(join(ROOT, 'templates', s.t), 'utf8'), v));
  writeFileSync(join(dir, 'project.json'), JSON.stringify({
    bpm: 120, fps: 30, size: [1920, 1080],
    formats: { vertical: [1080, 1920], square: [1080, 1080] },
    cutSfx: 'whoosh',
    scenes: plan.map((s) => ({ file: s.out, beats: 6, ...(s.needs ? { needs: s.needs } : {}) })),
    captions: [],
  }, null, 2) + '\n');
  writeFileSync(join(dir, 'AGENTS.md'), readFileSync(join(ROOT, 'templates/AGENTS.md'), 'utf8'));
  writeFileSync(join(dir, '.gitignore'), 'out/\n.frames/\n');

  return [`project: ${dir}`, ...log, '', `next:  studio doctor && studio lint ${relative(repo, dir) || '.'} && studio loop ${relative(repo, dir) || '.'} --first`].join('\n');
}
