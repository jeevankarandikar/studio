#!/usr/bin/env python3
"""A site through Stageshow's playground and its film gate, on this machine.

Stageshow (skills/stageshow) judges elements marked .ss-stage. A site's pages
have none, so this serves the site's folder on loopback and, only when a URL
asks with ?stageshow=, adds stage.js to the page: on a page it marks the
figures the project names, and on a scene it plays the scene once through to
the frame it holds. Nothing is added to a page fetched without the query.

The project describes itself in a stageshow.json (see docs/stageshow-pass.md):

    python3 scripts/stageshow_pass.py serve --config path/to/stageshow.json
    python3 scripts/stageshow_pass.py link  --config path/to/stageshow.json
    python3 scripts/stageshow_pass.py gate  --config path/to/stageshow.json --out DIR
    python3 scripts/stageshow_pass.py selftest

`link` writes examples/<prefix>-*/ into skills/stageshow and lists them in this
repository's .git/info/exclude, so a private site never enters studio's history.
Each example frames `serve`, which runs beside the playground (`npm run dev` in
skills/stageshow).
"""
import argparse
import concurrent.futures
import json
import os
import signal
import subprocess
import sys
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent.parent
STAGESHOW = HERE / "skills" / "stageshow"
TAG = '<script src="/__stageshow/stage.js"></script>'
FILM_TIMEOUT_S = 300

STAGE_JS = r"""
(function () {
  var q = new URLSearchParams(location.search), mode = q.get('stageshow');
  var PICKS = __PICKS__;
  function page() {
    var picks = [].slice.call(document.querySelectorAll(PICKS));
    if (!picks.length) picks = [document.querySelector('main') || document.body];
    picks.forEach(function (el) { el.classList.add('ss-stage'); });
  }
  function scene() {
    var b = document.body, h = document.documentElement, f = window.__format;
    var W = f ? f.w : (+q.get('w') || 1920), H = f ? f.h : (+q.get('h') || 1200);
    var cut = (q.get('cut') || '0,0,0,0').split(',').map(Number).concat([0, 0, 0, 0]);
    var parent = q.get('drive') === 'parent';
    if (!parent) {
      var col = +q.get('col') || innerWidth, s = col / (W - cut[2] - cut[3]);
      h.style.cssText += ';width:' + col + 'px;height:' + Math.round((H - cut[0] - cut[1]) * s) + 'px;overflow:hidden;';
      b.style.cssText += ';width:' + W + 'px;height:' + H + 'px;transform-origin:0 0;transform:translate(' +
        (-cut[2] * s) + 'px,' + (-cut[0] * s) + 'px) scale(' + s + ');';
    }
    b.classList.add('ss-stage');
    b.setAttribute('data-layout', f ? f.name : 'wide');
    b.setAttribute('aria-label', location.pathname.split('/').pop());
    var from = window.__start || 0;
    var hold = window.__reset ? window.__reset - 0.05 : window.__poster;
    var beats = [];
    try { if (typeof T === 'object' && T) for (var k in T) if (typeof T[k] === 'number') beats.push([T[k], k]); } catch (e) {}
    beats.push([window.__poster, 'poster']);
    beats.sort(function (a, c) { return a[0] - c[0]; });
    function seek(t) {
      window.__seek(t);
      var m = null;
      beats.forEach(function (x) { if (t >= x[0]) m = x[1]; });
      if (m) b.setAttribute('data-mark', m);
    }
    var info = { type: 'stageshow:info', from: from, hold: hold, poster: window.__poster, dur: window.__dur, w: W, h: H, cut: cut };
    var external = false;
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'stageshow:hello') e.source.postMessage(info, e.origin === 'null' ? '*' : e.origin);
      if (d.type === 'stageshow:seek' && typeof d.t === 'number') { external = true; seek(d.t); }
    });
    if (parent) { if (window.parent !== window) window.parent.postMessage(info, '*'); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { seek(window.__poster); b.setAttribute('data-still', ''); return; }
    var slow = (window.__stageshow && window.__stageshow.slow) || 1, t0 = null;
    seek(from);
    function tick(now) {
      if (external) return;
      if (t0 === null) t0 = now;
      var t = from + (now - t0) / 1000 / slow;
      if (t >= hold) { seek(hold); b.setAttribute('data-mark', 'held'); return; }
      seek(t);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function go() { if (mode === 'scene') { if (window.__seek) scene(); } else page(); }
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
})();
"""

DEFAULTS = {
    "root": ".",
    "port": 4817,
    "widths": [1440, 820, 390],
    "prefix": "site",
    "picks": "figure",
    "pages": {"home": "/"},
    "films": {},
    "scenes": {"dir": "scenes", "names": [], "cuts": {}, "phone": {}, "hash": "", "column": None},
    "stills": "",
    "background": "#FFFFFF",
}


def load(path: Path) -> dict:
    """The project's stageshow.json over the defaults, with `root` made absolute beside the file."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    cfg = {**DEFAULTS, **raw}
    cfg["scenes"] = {**DEFAULTS["scenes"], **(raw.get("scenes") or {})}
    cfg["root"] = (path.parent / cfg["root"]).resolve()
    unknown = sorted(set(raw) - set(DEFAULTS))
    if unknown:
        raise SystemExit(f"{path}: unknown keys {', '.join(unknown)}")
    missing = sorted(set(cfg["films"]) - set(cfg["pages"]))
    if missing:
        raise SystemExit(f"{path}: films name pages that are not in pages: {', '.join(missing)}")
    return cfg


def films_of(cfg: dict, page: str) -> list[list[str]]:
    """A page's films as [part, selector, kind]; a page the project did not break up is its main, still."""
    return [list(f) for f in cfg["films"].get(page) or [["main", "main", "still"]]]


def stage_js(cfg: dict) -> str:
    return STAGE_JS.replace("__PICKS__", json.dumps(cfg["picks"]))


def inject(html: str) -> str:
    """The page with stage.js added once, at the end of its body."""
    if TAG in html:
        return html
    at = html.lower().rfind("</body>")
    return html + TAG if at < 0 else html[:at] + TAG + html[at:]


def resolve(root: Path, path: str) -> Path | None:
    """The file under root a request path names, with clean URLs as most hosts serve them, or None."""
    rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
    target = (root / rel).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None
    if target.is_dir():
        target = target / "index.html"
    elif not target.exists() and target.with_suffix(".html").exists() and not target.suffix:
        target = target.with_suffix(".html")
    return target if target.is_file() else None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, root: Path, script: str, **kwargs):
        self.root = root
        self.script = script
        super().__init__(*args, directory=str(root), **kwargs)

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]).startswith("4"):
            sys.stderr.write(f"{args[1]} {args[0]} from {self.headers.get('Referer', '?')}\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parts = urlsplit(self.path)
        if parts.path == "/__stageshow/stage.js":
            return self._send(self.script.encode(), "text/javascript")
        target = resolve(self.root, parts.path)
        if target is None and parts.path == "/favicon.ico":
            return self._send(b"", "image/x-icon")
        if target is None:
            return self.send_error(404)
        if target.suffix == ".html" and "stageshow" in parse_qs(parts.query):
            return self._send(inject(target.read_text(encoding="utf-8")).encode(), "text/html; charset=utf-8")
        self.path = "/" + str(target.relative_to(self.root.resolve()))
        return super().do_GET()

    def _send(self, body: bytes, kind: str):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class Server(ThreadingHTTPServer):
    # three Chromes loading one page at once overflow the default backlog of 5, and Chrome reads that as a reset
    request_queue_size = 256
    daemon_threads = True


def server(cfg: dict, port: int) -> Server:
    return Server(("127.0.0.1", port), partial(Handler, root=cfg["root"], script=stage_js(cfg)))


SCENE_TSX = """import { useContext, useEffect, useRef, useState } from 'react'
import { StillContext } from '../../kit/reduced-motion'

// The scene "NAME", framed from scripts/stageshow_pass.py serve (written by its link command, not tracked here).
const ORIGIN = 'http://127.0.0.1:PORT'
type Info = { from: number; hold: number; poster: number; w: number; h: number; cut: number[] }
export default function Scene() {
  const still = useContext(StillContext)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const hear = (e: MessageEvent) => { if (e.origin === ORIGIN && e.data?.type === 'stageshow:info') setInfo(e.data) }
    window.addEventListener('message', hear)
    return () => window.removeEventListener('message', hear)
  }, [])
  useEffect(() => {
    if (!box.current || !info) return
    const fit = new ResizeObserver(() => setScale(box.current!.clientWidth / (info.w - info.cut[2] - info.cut[3])))
    fit.observe(box.current)
    return () => fit.disconnect()
  }, [info])
  useEffect(() => {
    if (!info) return
    const seek = (t: number) => frame.current?.contentWindow?.postMessage({ type: 'stageshow:seek', t }, ORIGIN)
    if (still) { seek(info.poster); return }
    let raf = 0, t0 = -1
    const tick = (now: number) => {
      if (t0 < 0) t0 = now
      const t = Math.min(info.hold, info.from + (now - t0) / 1000)
      seek(t)
      if (t < info.hold) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [info, still])
  const w = info ? info.w - info.cut[2] - info.cut[3] : 1920, h = info ? info.h - info.cut[0] - info.cut[1] : 1200
  return <div ref={box} style={{ width: '100%', aspectRatio: `${w} / ${h}`, position: 'relative', overflow: 'hidden', background: 'BACKGROUND' }}>
    <iframe ref={frame} title="NAME" src={`${ORIGIN}/DIR/NAME.html?stageshow=scene&drive=parentCUT#format=wideHASH`} width={info?.w ?? 1920} height={info?.h ?? 1200}
      style={{ position: 'absolute', left: 0, top: 0, border: 0, transformOrigin: '0 0', transform: `translate(${-(info?.cut[2] ?? 0) * scale}px,${-(info?.cut[0] ?? 0) * scale}px) scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }} />
  </div>
}
"""

PAGE_TSX = """import { useEffect, useRef, useState } from 'react'

// The NAME page at a desktop or phone viewport, framed from scripts/stageshow_pass.py serve (not tracked here).
const SRC = 'http://127.0.0.1:PORTPATH'
export default function Page() {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(880)
  useEffect(() => {
    const fit = new ResizeObserver(() => setWidth(box.current!.clientWidth))
    fit.observe(box.current!)
    return () => fit.disconnect()
  }, [])
  const view = width < 500 ? 390 : 1440, height = width < 500 ? 844 : 900, s = width / view
  return <div ref={box} style={{ width: '100%', height: height * s, position: 'relative', overflow: 'hidden' }}>
    <iframe title="NAME" src={SRC} width={view} height={height} style={{ position: 'absolute', left: 0, top: 0, border: 0, transformOrigin: '0 0', transform: `scale(${s})` }} />
  </div>
}
"""

STILLS_TSX = """// Every still under the site's STILLS folder, at its own size, from scripts/stageshow_pass.py serve (not tracked here).
const ORIGIN = 'http://127.0.0.1:PORT'
const SHOTS: string[] = LIST
export default function Stills() {
  return <div style={{ display: 'grid', gap: 24, padding: 16, background: 'BACKGROUND' }}>
    {SHOTS.map(path => <figure key={path} style={{ margin: 0 }}>
      <img src={`${ORIGIN}/${path}`} alt="" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
      <figcaption style={{ font: '12px ui-monospace, Menlo, monospace', marginTop: 6, color: '#55555B' }}>{path}</figcaption>
    </figure>)}
  </div>
}
"""


def scene_hash(cfg: dict, extra: str = "") -> str:
    """What follows #format=… on a scene's URL, from the project and the command line."""
    parts = [p for p in (cfg["scenes"]["hash"], extra) if p]
    return "".join("&" + p.lstrip("&") for p in parts)


def examples(cfg: dict, port: int, extra_hash: str = "") -> dict[str, str]:
    """The playground example folders `link` writes, by name, each to its index.tsx."""
    root, sc, prefix = cfg["root"], cfg["scenes"], cfg["prefix"]
    out = {}
    for name in sc["names"]:
        if (root / sc["dir"] / f"{name}.html").exists():
            cut = f"&cut={sc['cuts'][name]}" if name in sc["cuts"] else ""
            out[f"{prefix}-scene-{name}"] = (SCENE_TSX.replace("NAME", name).replace("PORT", str(port))
                                            .replace("DIR", sc["dir"]).replace("CUT", cut)
                                            .replace("HASH", scene_hash(cfg, extra_hash))
                                            .replace("BACKGROUND", cfg["background"]))
    for name, path in cfg["pages"].items():
        out[f"{prefix}-page-{name}"] = PAGE_TSX.replace("NAME", name).replace("PORTPATH", f"{port}{path}")
    if cfg["stills"] and (root / cfg["stills"]).is_dir():
        shots = sorted(str(p.relative_to(root)) for p in (root / cfg["stills"]).rglob("*")
                       if p.suffix in (".webp", ".png", ".jpg", ".jpeg", ".avif"))
        out[f"{prefix}-stills"] = (STILLS_TSX.replace("STILLS", cfg["stills"]).replace("PORT", str(port))
                                   .replace("LIST", json.dumps(shots, indent=1)).replace("BACKGROUND", cfg["background"]))
    return out


def link(cfg: dict, port: int, extra_hash: str = "", stageshow: Path = STAGESHOW, git_dir: Path = HERE / ".git") -> list[str]:
    """Writes the examples into the playground and keeps them out of this repository's history; returns their names."""
    folder = stageshow / "examples"
    prefix = cfg["prefix"]
    for old in folder.glob(f"{prefix}-*/index.tsx"):
        old.unlink()
    written = []
    for name, source in examples(cfg, port, extra_hash).items():
        (folder / name).mkdir(parents=True, exist_ok=True)
        (folder / name / "index.tsx").write_text(source, encoding="utf-8")
        written.append(name)
    if git_dir.is_file():  # a worktree's .git is a file naming the real one
        git_dir = Path(git_dir.read_text(encoding="utf-8").split(":", 1)[1].strip()).parents[1]
    exclude = git_dir / "info" / "exclude"
    line = f"skills/stageshow/examples/{prefix}-*/"
    lines = exclude.read_text(encoding="utf-8").splitlines() if exclude.exists() else []
    if line not in lines:
        exclude.parent.mkdir(parents=True, exist_ok=True)
        exclude.write_text("\n".join(lines + [line]) + "\n", encoding="utf-8")
    return written


MEASURE_MJS = """
import { chromium } from 'PLAYWRIGHT'
const [base, path, figure, key, inner, ...widths] = process.argv.slice(1)
const browser = await chromium.launch({ channel: 'chrome' })
const out = {}
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: +w, height: 900 } })
  await page.goto(base + path, { waitUntil: 'networkidle' })
  out[w] = await page.evaluate(([figure, key, inner]) => Object.fromEntries([...document.querySelectorAll(figure)]
    .map(f => [f.dataset[key], (inner ? f.querySelector(inner) : f)?.clientWidth || 0])), [figure, key, inner])
  await page.close()
}
await browser.close()
console.log(JSON.stringify(out))
"""


def columns(cfg: dict, base: str, widths: tuple[int, ...]) -> dict[str, dict[str, int]]:
    """The width a page draws each scene at, per viewport width, read from the page itself; {} when the project
    names no column."""
    col = cfg["scenes"].get("column")
    if not col or not cfg["scenes"]["names"]:
        return {}
    script = MEASURE_MJS.replace("PLAYWRIGHT", str(STAGESHOW / "node_modules" / "playwright-core" / "index.mjs"))
    done = subprocess.run(["node", "--input-type=module", "-e", script, base, col.get("page", "/"), col["figure"],
                           col.get("key", "scene"), col.get("inner", ""), *map(str, widths)],
                          capture_output=True, text=True, timeout=120, check=True)
    return json.loads(done.stdout)


def targets(cfg: dict, base: str, widths: tuple[int, ...], cols: dict[str, dict[str, int]],
            extra_hash: str = "") -> list[tuple[str, int, str, str, str]]:
    """(name, width, url, select, kind) for every figure of every page and every scene the gate films."""
    sc = cfg["scenes"]
    fallback = (sc.get("column") or {}).get("default", "")
    tail = scene_hash(cfg, extra_hash)
    out = []
    for w in widths:
        for page, path in cfg["pages"].items():
            for part, select, kind in films_of(cfg, page):
                out.append((f"page-{page}-{part}", w, f"{base}{path}?stageshow=page", select, kind))
        for name in sc["names"]:
            measured = cols.get(str(w), {})
            col = measured.get(name) or measured.get(fallback) or w
            phone = sc["phone"].get(name)
            fmt = f"phone&size={phone}" if phone and w <= 600 else "wide"
            cut = f"&cut={sc['cuts'][name]}" if name in sc["cuts"] and fmt == "wide" else ""
            out.append((f"scene-{name}", w, f"{base}/{sc['dir']}/{name}.html?stageshow=scene&col={col}{cut}#format={fmt}{tail}", "", "film"))
    return out


def runs(planned: list[tuple[str, int, str, str, str]], first: int) -> list[tuple[str, int, str, str, str]]:
    """Each target's films: the gate at every width; --states, and a scene's reduced-motion still, at the first."""
    out = []
    for name, w, url, select, kind in planned:
        out.append((name, w, url, select, "gate" if kind == "film" else "gate-still"))
        if kind == "film" and w == first:
            out.append((name, w, url, select, "states"))
        if name.startswith("scene-") and w == first:
            out.append((name, w, url, select, "reduced"))
    return out


def film(out: Path, name: str, width: int, url: str, select: str, kind: str) -> tuple[str, int, str, int, str]:
    stem = out / f"{name}-{width}{'' if kind.startswith('gate') else '-' + kind}"
    args = ["node", str(STAGESHOW / "scripts" / "film.mjs"), url, "--width", str(width), "--out", f"{stem}.png"]
    args += ["--select", select] if select else []
    # 16 shots over 20 s: a sheet of 36 shots of a 1300 px stage at 2x is more than Chrome lays out, and film.mjs
    # then waits on the closed browser. The jump and motion scans run on every animation frame whatever the count.
    args += {"gate": ["--gate", "--count", "16", "--every", "1250", "--report", f"{stem}.json"],
             "gate-still": ["--gate", "--still", "--report", f"{stem}.json"],
             "states": ["--states"], "reduced": ["--reduced", "--still"]}[kind]
    # film.mjs runs itself again in a child, which outlives a timeout unless its whole group is ended
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        output, _ = proc.communicate(timeout=FILM_TIMEOUT_S)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGTERM)
        output, code = (proc.communicate()[0] or "") + f"film: no answer in {FILM_TIMEOUT_S} s\n", 124
    stem.with_suffix(".txt").write_text(f"$ {' '.join(args)}\n{output}exit {code}\n", encoding="utf-8")
    lines = [line for line in output.splitlines() if line.strip()]
    verdict = next((line for line in lines if line.startswith("rehearsal ")), lines[-1] if lines else "")
    return name, width, kind, code, verdict


def gate(cfg: dict, out: Path, port: int, widths: tuple[int, ...], only: list[str], jobs: int, extra_hash: str = "") -> int:
    import threading

    out.mkdir(parents=True, exist_ok=True)
    if not port:
        own = server(cfg, 0)
        threading.Thread(target=own.serve_forever, daemon=True).start()
        port = own.server_address[1]
    base = f"http://127.0.0.1:{port}"
    cols = columns(cfg, base, widths)
    (out / "columns.json").write_text(json.dumps(cols, indent=1), encoding="utf-8")
    todo = runs([t for t in targets(cfg, base, widths, cols, extra_hash)
                 if not only or any(t[0].startswith(o) for o in only)], widths[0])
    results, stuck = {}, []
    with concurrent.futures.ThreadPoolExecutor(jobs) as pool:
        for run, done in zip(todo, pool.map(lambda r: film(out, *r), todo)):
            print(f"{done[0]:<24} {done[1]:>5} {done[2]:<10} exit {done[3]}  {done[4]}", flush=True)
            results[run] = done
            if done[3] == 124:
                stuck.append(run)
    # a film with no answer beside another Chrome has finished when filmed alone
    for run in stuck:
        results[run] = done = film(out, *run)
        print(f"{done[0]:<24} {done[1]:>5} {done[2]:<10} exit {done[3]}  {done[4]} (alone)", flush=True)
    failed = sum(1 for _, _, kind, _, verdict in results.values()
                 if kind.startswith("gate") and not verdict.startswith("rehearsal passed"))
    print(f"{len(todo)} films, {failed} gates not passed, in {out}")
    return 1 if failed else 0


def selftest() -> int:
    page = "<html><body><p>x</p></body></html>"
    assert inject(page).endswith(TAG + "</body></html>"), "stage.js goes in at the end of the body"
    assert inject(inject(page)).count(TAG) == 1, "stage.js goes in once"
    assert inject("<p>no body") == "<p>no body" + TAG
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        site = tmp / "site"
        (site / "scenes").mkdir(parents=True)
        (site / "shots").mkdir()
        (site / "index.html").write_text("home")
        (site / "about.html").write_text("about")
        (site / "scenes" / "hero.html").write_text("hero")
        (site / "scenes" / "search.html").write_text("search")
        (site / "shots" / "a.webp").write_bytes(b"")
        (tmp / "stageshow.json").write_text(json.dumps({
            "root": "site", "prefix": "demo", "picks": "figure, #panel",
            "pages": {"home": "/", "about": "/about"},
            "films": {"home": [["hero", "#hero", "film"], ["own", "#own figure", "still"]]},
            "scenes": {"names": ["hero", "search", "gone"], "cuts": {"search": "270,210,520,520"},
                       "phone": {"search": "600x460"}, "hash": "theme=light",
                       "column": {"figure": "figure.scene", "inner": ".stage", "default": "hero"}},
            "stills": "shots"}))
        cfg = load(tmp / "stageshow.json")
        assert cfg["root"] == site.resolve() and cfg["port"] == 4817, "root sits beside the file, and the defaults fill the rest"
        assert films_of(cfg, "about") == [["main", "main", "still"]], "a page the project did not break up is its main"
        assert '"figure, #panel"' in stage_js(cfg) and "__PICKS__" not in stage_js(cfg), "the project's picks mark the stages"
        assert resolve(site, "/") == (site / "index.html").resolve()
        assert resolve(site, "/about?stageshow=page") == (site / "about.html").resolve(), "clean URLs"
        assert resolve(site, "/../stageshow.json") is None, "nothing outside the root"
        assert resolve(site, "/missing") is None
        made = examples(cfg, 4999, "panel=2.0")
        assert set(made) == {"demo-scene-hero", "demo-scene-search", "demo-stills", "demo-page-home", "demo-page-about"}, made
        assert "/scenes/search.html?stageshow=scene&drive=parent&cut=270,210,520,520#format=wide&theme=light&panel=2.0`" \
            in made["demo-scene-search"], "a scene keeps its cut and the project's and the command's hash"
        assert '"shots/a.webp"' in made["demo-stills"]
        assert all(w not in s for s in made.values() for w in ("NAME", "PORT", "CUT", "HASH", "BACKGROUND", "DIR/")), \
            "every placeholder is filled"
        play = tmp / "stageshow"
        (play / "examples" / "demo-old").mkdir(parents=True)
        (play / "examples" / "demo-old" / "index.tsx").write_text("old")
        git = tmp / "repo.git"
        names = link(cfg, 4999, stageshow=play, git_dir=git)
        assert len(names) == 5 and not (play / "examples" / "demo-old" / "index.tsx").exists(), "a stale example goes"
        assert "skills/stageshow/examples/demo-*/" in (git / "info" / "exclude").read_text(), "examples stay out of git"
        link(cfg, 4999, stageshow=play, git_dir=git)
        assert (git / "info" / "exclude").read_text().count("demo-*") == 1, "the exclude line is written once"
        bad = tmp / "bad.json"
        bad.write_text(json.dumps({"films": {"nope": []}}))
        try:
            load(bad)
            raise AssertionError("films for a page not in pages loaded")
        except SystemExit:
            pass
        bad.write_text(json.dumps({"pagez": {}}))
        try:
            load(bad)
            raise AssertionError("an unknown key loaded")
        except SystemExit:
            pass
    cols = {"1440": {"hero": 1356, "search": 1300}, "390": {"hero": 358}}
    planned = targets(cfg, "http://h", (1440, 390), cols, "panel=2.0")
    urls = {(n, w): u for n, w, u, _, _ in planned}
    assert urls[("scene-hero", 1440)] == "http://h/scenes/hero.html?stageshow=scene&col=1356#format=wide&theme=light&panel=2.0"
    assert urls[("scene-search", 1440)].startswith("http://h/scenes/search.html?stageshow=scene&col=1300&cut=270,210,520,520#format=wide")
    assert "col=358" in urls[("scene-search", 390)] and "#format=phone&size=600x460&" in urls[("scene-search", 390)], \
        "an unmeasured scene takes the default's column, and a phone layout at 390"
    assert urls[("page-about-main", 390)] == "http://h/about?stageshow=page"
    figures = sum(len(films_of(cfg, p)) for p in cfg["pages"])
    assert len(planned) == 2 * (figures + len(cfg["scenes"]["names"])), "every figure and scene at each width"
    kinds = [(n, w, k) for n, w, _, _, k in runs(planned, 1440)]
    assert ("page-home-own", 390, "gate-still") in kinds and ("page-home-hero", 390, "gate") in kinds
    assert ("scene-hero", 1440, "states") in kinds and ("scene-hero", 390, "states") not in kinds
    assert ("scene-hero", 1440, "reduced") in kinds and ("page-home-hero", 1440, "reduced") not in kinds
    assert columns({**cfg, "scenes": {**cfg["scenes"], "column": None}}, "http://h", (1440,)) == {}, \
        "a project with no column measures nothing"
    print("stageshow_pass selftest: ok")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("serve", "link", "gate"):
        s = sub.add_parser(name)
        s.add_argument("--config", type=Path, default=Path("stageshow.json"))
        s.add_argument("--port", type=int, default=None)
        s.add_argument("--hash", default="", help="added to every scene's #format=…, such as panel=1.0.20")
        if name == "gate":
            s.add_argument("--out", type=Path, default=Path(tempfile.gettempdir()) / "stageshow-pass")
            s.add_argument("--widths", default="", help="comma-separated, in place of the project's")
            s.add_argument("--only", default="", help="comma-separated names, such as page-home,scene-hero")
            s.add_argument("--jobs", type=int, default=2)
    sub.add_parser("selftest")
    a = parser.parse_args(argv)
    if a.cmd == "selftest":
        return selftest()
    cfg = load(a.config.resolve())
    port = cfg["port"] if a.port is None else a.port
    if a.cmd == "serve":
        print(f"{cfg['root']} on http://127.0.0.1:{port} (add ?stageshow=page or ?stageshow=scene for the gate)", flush=True)
        try:
            server(cfg, port).serve_forever()
        except KeyboardInterrupt:
            pass
        return 0
    if a.cmd == "link":
        names = link(cfg, port, a.hash)
        print(f"{len(names)} examples in {STAGESHOW / 'examples'}, kept out of git by .git/info/exclude")
        return 0
    widths = tuple(int(w) for w in a.widths.split(",")) if a.widths else tuple(cfg["widths"])
    # gate serves the root itself when no --port names a server already running
    return gate(cfg, a.out, 0 if a.port is None else port, widths, [o for o in a.only.split(",") if o], a.jobs, a.hash)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
