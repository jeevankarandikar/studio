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

// Deterministic fractional hash: same input, same output, every run. This is the only
// randomness allowed in scenes, since Math.random is lint-banned.
function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// A kick that fires only on bar starts (every 4th beat). Multiply it into a scale or a
// position the way kick() answers every beat, so big moments land on the downbeat.
const downbeat = (ctx) => (ctx.beatIndex % 4 === 0 ? spring(ctx.beatPhase * ctx.beatSec, { k: 320, c: 13, from: 1, to: 0 }) : 0);

// A textured stroke along a polyline, drawn with plain canvas. `progress` (0..1) reveals the
// stroke from the first point, so it can draw itself on over a scene. Bristle offsets come
// from hash1, never from Math.random, so the same frame twice is byte-identical.
function brushStroke(g, pts, { progress = 1, width = 10, color = '#111', seed = 0, bristles = 3 } = {}) {
  if (pts.length < 2 || progress <= 0) return 0;
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d); total += d;
  }
  let left = progress * total;
  g.lineCap = 'round';
  for (let i = 1; i < pts.length && left > 0; i++) {
    const take = Math.min(seg[i - 1], left); left -= take;
    const u = take / seg[i - 1];
    const x0 = pts[i - 1][0], y0 = pts[i - 1][1];
    const x1 = x0 + (pts[i][0] - x0) * u, y1 = y0 + (pts[i][1] - y0) * u;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let b = 0; b < bristles; b++) {
      const off = (hash1(seed + i * 13.7 + b * 7.3) - 0.5) * width * 0.9;
      g.strokeStyle = color;
      g.globalAlpha = b === 0 ? 0.9 : 0.35;
      g.lineWidth = width * (0.35 + 0.65 * hash1(seed + b * 3.1 + i));
      g.beginPath(); g.moveTo(x0 + nx * off, y0 + ny * off); g.lineTo(x1 + nx * off, y1 + ny * off); g.stroke();
    }
  }
  g.globalAlpha = 1;
  return progress;
}

// Drifting particle orbs, seeded from a scene seed. Positions, sizes, drift speeds and
// phases all come from hash1, so the field is a pure function of t and seed.
function orbField(g, t, { seed = 0, count = 24, w = 1920, h = 1080, color = '#111' } = {}) {
  for (let i = 0; i < count; i++) {
    const bx = hash1(seed + i * 3.1) * w, by = hash1(seed + i * 7.7) * h;
    const ph = hash1(seed + i * 1.3) * Math.PI * 2;
    const spd = 0.1 + hash1(seed + i * 5.9) * 0.25;
    const amp = 20 + hash1(seed + i * 9.4) * 60;
    const x = bx + Math.sin(t * spd + ph) * amp;
    const y = by + Math.cos(t * spd * 0.8 + ph) * amp * 0.6;
    g.globalAlpha = 0.10 + hash1(seed + i * 2.3) * 0.25;
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, hash1(seed + i * 4.7) * 12 + 2, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

// A full-screen impact word: springs in large and settles, one word per beat. Set the word's
// font size in CSS; this only drives scale and opacity from t.
function impactWord(el, t, delay = 0, { from = 2.4 } = {}) {
  el.style.transform = `scale(${sp(t, delay, spring.snappy, from, 1)})`;
  el.style.opacity = clamp((t - delay) / 0.12);
}

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
