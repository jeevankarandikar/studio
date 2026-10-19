// Shared scene helpers. Everything is a pure function of t (seconds) and the beat context.
// `studio init` copies this next to the scenes; edit your copy freely.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sp = (t, delay, preset = spring.snappy, from = 0, to = 1) => spring(t - delay, { ...preset, from, to });
const pulse = (ctx, amp = 1, decay = 7) => Math.exp(-ctx.beatPhase * decay) * amp; // spike on each beat
const $ = (id) => document.getElementById(id);
function pos(el, x, y, extra = '') { el.style.transform = `translate(${x}px,${y}px) ${extra}`; }

// A spring re-triggered every beat, from 1 down to 0 with a little overshoot. Multiply it into
// positions and scales so the layout answers the music.
const kick = (ctx, k = 320, c = 13) => spring(ctx.beatPhase * ctx.beatSec, { k, c, from: 1, to: 0 });

// Splits an element's text into word spans; returns them for per-word springs.
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'word';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
}

// Words rise and fade in, one after another. Call every frame with the spans from splitWords.
function wordsIn(words, t, { delay = 0, step = 0.08, rise = 50, preset = spring.snappy } = {}) {
  words.forEach((w, i) => {
    const d = delay + i * step;
    pos(w, 0, sp(t, d, preset, rise, 0));
    w.style.opacity = clamp((t - d) / 0.15);
  });
}

// Characters appear at a fixed rate. Returns how many are showing.
function typeText(textNode, full, t, start, cps = 28) {
  const n = Math.floor(clamp((t - start) * cps, 0, full.length));
  textNode.textContent = full.slice(0, n);
  return n;
}

// A number that counts up on a spring: countUp(el, t, 0.5, 12840, (v) => v.toLocaleString())
function countUp(el, t, start, to, fmt = (v) => Math.round(v)) {
  el.textContent = fmt(sp(t, start, spring.soft, 0, to));
}

// Draws an SVG path with a spring. Call prepPath once, drawPath every frame.
function prepPath(p) { const len = p.getTotalLength(); p.style.strokeDasharray = len; return len; }
function drawPath(p, len, t, delay, preset = spring.soft) { p.style.strokeDashoffset = len * (1 - clamp(sp(t, delay, preset))); }
function onPath(p, len, u) { return p.getPointAtLength(clamp(u) * len); }

// A rounded card with a soft shadow. Returns the element; position it with pos() each frame.
function card(parent, { w = 300, h = 200, radius = 36, html = '' } = {}) {
  const d = document.createElement('div');
  d.className = 'abs card';
  d.style.cssText = `left:0;top:0;width:${w}px;height:${h}px;border-radius:${radius}px;`;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}

// A product screenshot in a window frame. src is relative to the scene file, e.g. ../brand/shots/home.png.
// Use the returned element with pos(); the image inside can be nudged with parallax().
function shotFrame(parent, src, { w = 1100, h = 690, title = '' } = {}) {
  const d = document.createElement('div');
  d.className = 'abs shot';
  d.style.cssText = `left:0;top:0;width:${w}px;height:${h}px;`;
  d.innerHTML = '<div class="shot-bar"><i></i><i></i><i></i><span></span></div><div class="shot-view"><img></div>';
  d.querySelector('span').textContent = title;
  d.querySelector('img').src = src;
  parent.appendChild(d);
  return d;
}
function parallax(frame, x, y, scale = 1) {
  const img = frame.querySelector('.shot-view img');
  img.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
}

// Slow ambient field so no frame is ever static: drifting hairlines.
function ambient(root, t, n = 7) {
  if (!root.children.length) {
    for (let i = 0; i < n; i++) {
      const r = document.createElement('div');
      r.className = 'rule';
      r.style.width = '1920px';
      root.appendChild(r);
    }
  }
  [...root.children].forEach((r, i) => {
    const y = ((i + 0.5) / n) * 1080 + Math.sin(t * 0.5 + i * 1.7) * 18 + t * 6 * (i % 2 ? 1 : -1);
    r.style.transform = `translateY(${((y % 1080) + 1080) % 1080}px)`;
    r.style.opacity = 0.35 + 0.35 * Math.sin(t * 0.8 + i);
  });
}
