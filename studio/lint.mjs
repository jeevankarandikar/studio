// Bans basic CSS transitions, easing curves and non-deterministic time in scenes.
// Checks the code of a scene (style blocks, scripts, inline styles) and the local CSS/JS files it links,
// not the words shown on screen.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject } from './project.mjs';

const RULES = [
  [/\btransition(-\w+)?\s*:/i, 'CSS transition'],
  [/\banimation(-\w+)?\s*:/i, 'CSS animation'],
  [/\.style\.(transition|animation)\w*\s*=|setProperty\(\s*['"](transition|animation)/i, 'transition or animation set from script'],
  [/@keyframes/i, '@keyframes'],
  [/cubic-bezier|\bease(-in|-out|-in-out)?\b|\blinear\(/i, 'easing curve'],
  [/requestAnimationFrame|setTimeout|setInterval/, 'wall-clock scheduling'],
  [/Date\.now|performance\.now|new Date\(/, 'wall-clock time'],
  [/Math\.random/, 'unseeded randomness'],
  [/\.animate\(/, 'Web Animations API'],
];

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');

// Lints code only. `src` may be raw CSS or JS, or an HTML page (then only its code parts count).
export function lintSource(src) {
  let code = src;
  if (/<!doctype|<\/?(html|body|style|script|div|span|p|img|link|meta|svg|h[1-6]|a|b|i|em|strong)[\s>\/]/i.test(src)) {
    const parts = [];
    for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) parts.push(m[1]);
    for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) parts.push(m[1]);
    for (const m of src.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) parts.push(m[1]);
    for (const m of src.matchAll(/\sstyle\s*=\s*'([^']*)'/gi)) parts.push(m[1]);
    code = parts.join('\n');
  }
  const text = strip(code);
  const hits = [];
  for (const [re, label] of RULES) {
    const m = re.exec(text);
    if (m) hits.push(`${label} ("${m[0]}")`);
  }
  if (/text-transform\s*:\s*uppercase/i.test(text) && /text-align\s*:\s*center/i.test(text) && /gradient\(/i.test(text)) {
    hits.push('centered all-caps text on a gradient');
  }
  return hits;
}

// A scene file plus the local stylesheets and scripts it loads.
export function lintScene(file) {
  const html = readFileSync(file, 'utf8');
  const hits = lintSource(html).map((h) => h);
  const linked = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi), ...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)].map((m) => m[1]);
  for (const ref of linked) {
    if (/^(https?:)?\/\//.test(ref)) continue;
    const p = resolve(dirname(file), ref);
    if (!existsSync(p)) continue;
    for (const h of lintSource(readFileSync(p, 'utf8'))) hits.push(`${h} in ${ref}`);
  }
  return hits;
}

export function lintProject(ref) {
  const p = loadProject(ref);
  const report = {};
  for (const s of p.scenes) report[s.index] = lintScene(s.file);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: lint.mjs <project>'); process.exit(2); }
  const report = lintProject(arg);
  let bad = 0;
  for (const [i, hits] of Object.entries(report)) for (const h of hits) { bad++; console.log(`scene ${i}: ${h}`); }
  console.log(bad ? `${bad} violation(s)` : 'clean');
  process.exit(bad ? 1 : 0);
}
