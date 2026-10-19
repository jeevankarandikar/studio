// Closed-form damped spring, zero initial velocity. No easing curves anywhere in the studio.
// spring(t, { from, to, k, c, m }) -> value at t seconds after the trigger.
// Works as a classic script (page) and as a side-effect import (node).
(function (root) {
  function progress(t, k, c, m) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k / m);
    const z = c / (2 * Math.sqrt(k * m));
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      const a = z * w0;
      return 1 - Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const s = Math.sqrt(z * z - 1);
    const r1 = -w0 * (z - s);
    const r2 = -w0 * (z + s);
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }

  function spring(t, o = {}) {
    const { from = 0, to = 1, k = 170, c = 18, m = 1 } = o;
    return from + (to - from) * progress(t, k, c, m);
  }

  // Presets so scenes stay consistent. snappy overshoots a little, soft settles slowly.
  spring.snappy = { k: 260, c: 20, m: 1 };
  spring.soft = { k: 90, c: 16, m: 1 };
  spring.bouncy = { k: 200, c: 10, m: 1 };
  spring.progress = progress;

  root.spring = spring;
})(globalThis);
