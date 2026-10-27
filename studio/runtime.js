// Injected into every scene page before its own scripts. Time never comes from the wall clock.
// A scene registers window.scene = { render(t, frame, ctx) } and the capture loop calls __seek.
// A scene that lays itself out for other aspect ratios sets window.scene.native = true and reads
// window.__format = { name, w, h }. Every other scene is scaled to fit by the capture step.
(function () {
  const sp = (t, o) => (t <= 0 ? o.from : window.spring(t, o));

  function captionLayer() {
    let el = document.getElementById('__captions');
    if (!el) {
      el = document.createElement('div');
      el.id = '__captions';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:6%;display:flex;justify-content:flex-start;padding-left:8%;pointer-events:none;z-index:9999;';
      const pill = document.createElement('div');
      pill.style.cssText = 'font:500 44px/1.2 var(--display,Georgia,serif);color:var(--paper,#fff);background:var(--ink,#111);padding:14px 28px;border-radius:14px;max-width:80%;';
      el.appendChild(pill);
      document.body.appendChild(el);
    }
    return el;
  }

  function updateCaptions(tGlobal, beatSec) {
    const caps = window.__captions || [];
    if (!caps.length) return;
    const el = captionLayer();
    const pill = el.firstChild;
    const cur = caps.find((c) => tGlobal >= c.beat * beatSec && tGlobal < (c.beat + c.beats) * beatSec);
    if (!cur) { el.style.opacity = 0; return; }
    const a = cur.beat * beatSec, b = (cur.beat + cur.beats) * beatSec;
    const inK = sp(tGlobal - a, { from: 0, to: 1, k: 260, c: 20, m: 1 });
    const outK = sp(b - tGlobal, { from: 0, to: 1, k: 400, c: 30, m: 1 });
    const k = Math.min(Math.max(inK, 0), Math.max(outK, 0), 1);
    if (pill.textContent !== cur.text) pill.textContent = cur.text;
    el.style.opacity = k;
    pill.style.transform = `translateY(${(1 - inK) * 36}px)`;
  }

  window.__seek = function (frame, fps, beatSec, offsetFrames = 0) {
    const t = frame / fps;
    const beat = t / beatSec;
    window.scene.render(t, frame, { fps, beatSec, beat, beatIndex: Math.floor(beat), beatPhase: beat - Math.floor(beat) });
    updateCaptions((offsetFrames + frame) / fps, beatSec);
    return true;
  };
})();
