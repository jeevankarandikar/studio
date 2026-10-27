# studio

One repo for all kinds of content creation — ads, animation, motion design work — that turns HTML scenes into motion videos. It is the consolidated home: real content projects live here, in `projects/`, and it can take any design system as input — a website, a video, an app — by pointing at that system's repo or exported assets.

Scenes are plain HTML, CSS and JavaScript. Playwright captures every frame in headless Chrome, FFmpeg stitches the frames with a synthesized score into an MP4, and a critique loop scores each scene and flags the weak ones.

Related work: [HyperFrames](https://github.com/heygen-com/hyperframes) renders HTML to video for agents, Remotion, Motion Canvas and Revideo are code-first video frameworks, and [cstack](https://github.com/goodnight000/cstack) is a set of agent skills for reels. The review loop (strips around cuts, a mute test, a measured-versus-not-measured report) follows ideas from cstack. This tool adds a fixed motion rule set (closed-form springs, no CSS transitions), synthesized sound and the scoring loop.

## Install

Needs Node 22 or newer and FFmpeg.

```bash
git clone <this repo> ~/tools/studio && cd ~/tools/studio
npm install
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell
npm link            # puts `studio` on your PATH
studio doctor       # checks node, ffmpeg, the browser, and tells you the fix for each problem
```

Set `PLAYWRIGHT_BROWSERS_PATH=0` whenever you render, so it uses the browser installed above.

## Projects live here

```bash
studio loop personal --first      # a project in projects/, by bare name
studio loop projects/personal --first
studio sheet projects/personal 0  # 8-frame contact sheet of one scene, in seconds
```

`projects/` holds a first project as a normal project folder with its own brand pack. The same tool, rules and commands render any number of them, and only `brand/` changes.

- `projects/personal/` is a creator project. Brand: blackout, impact text, word-for-word captions, a day X/30 card. Scenes: title and day card, dopamine loop, impact text.

See `projects/README.md` and `projects/PROMPTS.md` for the prompt style behind the scene set.

## Use it in another repo

`studio init` still works outside studio, for a project that belongs in another repo (backward compatible):

```bash
cd ~/code/my-product
studio init                      # creates ./motion with a brand pack taken from the repo
studio loop motion --first       # render all scenes, score them
```

`studio init` reads the repo for a logo, font files, CSS color variables, reference images and screenshots, and the name and description from `package.json`. It reports what it found and what is missing. Nothing is invented: a missing font or reference image stops the render with a message.

### Any design system in

`studio init [--brand-from <source>]` accepts brand sources alongside the repo scan, in this order of precedence for colors: a design-tokens JSON file (colors, fonts), a CSS file with custom properties, or a folder — a site/app repo, an exported asset folder, or a folder of reference images and videos. For a video reference, ffmpeg extracts a poster frame into `brand/refs/`, so the two-reference-frames gate still works. A website or an app as input means pointing init at that site/app's repo or exported assets. There is no live web scraping and no Figma API dependency, by design — a font family named in a tokens file only lands in `fonts.json` if a matching font file was actually found.

The project folder carries its own `AGENTS.md` with the scene rules and commands, so an agent working in that repo knows how to author and render without reading this file.

## Gates

`studio gate` runs the film through approvals before the expensive render. First it renders one midpoint still per scene, cheap, and records approval per scene in `out/<tag>/gates/approval.json` (never in `scenes/`). Approve scenes with `studio gate <project> --approve 0,1`, reject with `--reject 2`. A rejected scene blocks the gate until it is fixed and re-stilled (`--restill`). Once every scene is approved, the gate renders a low-fps animatic (every 5th frame at 6 fps) with the synthesized score; approve it with `--approve-animatic` and the gate runs the full render. `sheet` and `watch` keep working as before; gates reuse the same capture code, they do not duplicate it.

## Commands

| command | does |
|---|---|
| `studio init [dir] [--brand-from <tokens.json\|theme.css\|dir>]` | make a project in the current repo (default `./motion`), or in `projects/` by hand; brand from the repo scan and/or the brand source |
| `studio gate <project> [--approve 0,1] [--reject 2] [--approve-animatic] [--restill]` | stills first, then a low-fps animatic with sound, then the full render — each stage only on approval |
| `studio loop <project> [--first] [--review]` | render, score, re-render weak scenes |
| `studio render <project> [--scene N] [--format name]` | render and stitch |
| `studio sheet <project> <scene>` | contact sheet for one scene |
| `studio watch <project> <scene>` | rebuild the sheet on every save |
| `studio frame <project> <scene> <frame>` | one frame as a PNG |
| `studio lint <project>` | motion rules, no browser needed |
| `studio review <project> [--auto] [--mute]` | reviewer brief (sheets, cut strips, peak strips), or run it through `claude -p`; `--mute` is the no-sound test |
| `studio verify <project>` | measure the render (loudness, size, first and last frame) and write `manifest.json` |
| `studio sfx [name \| --all]` | list the sound effects, or write them to `./sfx-audition/` to listen |
| `studio export <project>` | web MP4, WebM, poster and GIF |
| `studio check <project>` | same frame twice must be byte-identical |
| `studio doctor` | diagnose the environment |

A `<project>` is a path to a folder with a `project.json`, or a name found under `./motion/`.

## A project

```
motion/
  project.json     bpm, fps, size, scenes in beats, extra formats, captions, optional voiceover, optional job
  brand/           colors.json, fonts/ (+ fonts.json), logo.svg|png, refs/ (2+), shots/
  scenes/          NN-name.html, common.js, common.css
  out/  .frames/   gitignored
```

`project.json` can carry an optional `job`: one of `Storytelling`, `Relatable`, `Opinion`, `Advice`. It names what the film is for, not what it is about, and changes nothing about the render. An unknown value stops the load with a clear error. Structure templates live in `templates/`: `prep.html` (PREP: Point, Reason, Explain, Point restated), `loop.html` (Stakes, Big Question, Headfake/Contrast, Rehook around 65%), `silent.html` (struggle hook, payoff-promising timestamp, transformation beat, on-screen text only), `impact.html` (one full-screen word per beat, one sound per word). The first working projects using them are in `projects/`.

The render refuses to run until the brand pack loads: palette, at least one font, a logo, and two reference frames.

## The rules

- Time only comes from `render(t, frame, ctx)`. Lint rejects `Date`, `setTimeout`, `requestAnimationFrame` and `Math.random`.
- Motion is a closed-form damped spring, `spring(t - delay, { from, to, k, c, m })`, never an easing curve. Lint rejects CSS `transition`, `animation`, `@keyframes` and easing keywords.
- Scene lengths are in beats, so cuts land on the beat. 120 bpm at 30 fps gives 15 whole frames per beat.
- Audio is synthesized: a score from the bpm and a library of sound effects (click, key, type, tick, pop, whoosh, swipe, settle, thud, hit, riser, chime, success, error, blip, shutter). There is no stock audio and nothing to license. Scenes declare their own sounds in `window.scene.sfx`, from the same constants that place the visuals.
- No centered all-caps text on a gradient.

## Scoring and review

Each scene starts at 10. Points come off for dead frames (8 or more near-identical frames in a row), low motion density, a cut off the beat and lint hits. `studio review --auto` hands the contact sheets and `studio/critique/rubric.md` to a fresh-context model that sees nothing of how the scenes were built, and its score can only lower the mechanical one. Every scene needs 8 or more. The rubric also carries attention checks the reviewer judges from the sheets and strips (hook legible in the first frames, one clear first read, change frequency, caption readability at phone size, a fresh loop or rehook around 60-70%, fluff, and one sound per visual event). The mechanical score reports measurable proxies for these — longest static run, longest shot, cut count, caption presence — as notes, without changing the score; what cannot be measured stays reviewer-only, and the rubric is never a checklist the maker fills in.

## Sound effects

`studio sfx --all` writes every effect to `./sfx-audition/` so you can listen. A scene places sounds next to its visuals:

```js
window.scene = {
  sfx: [
    { t: 0.6, name: 'type', dur: 1.3, cps: 28 },   // keystrokes for a typing field
    { t: 1.25, name: 'tick', gain: 0.35 },
  ],
  render(t, f, ctx) { /* ... */ },
};
```

`project.json` can add `"cutSfx": "whoosh"` for a sound before every cut and `"sfx": [{ "beat": 4, "name": "riser" }]` for sounds placed by beat. The music is levelled first and effects sit on top, then a soft limiter and a final loudness pass to -16 LUFS with a -1.5 dB true-peak ceiling.

## Checks on a finished render

`studio verify` measures duration, size, frame rate, audio track, integrated loudness, true peak, and the first and last frame, and writes `out/<name>/manifest.json` with the tool versions, a hash of the project, scenes and brand files, the effects mixed in, and two lists: what was measured and what was not. The review brief adds consecutive-frame strips around each cut and at each scene's fastest moment. `studio review --mute` shows a judge the film with the sound off and asks what it understood.

## Formats and delivery

`project.json` can list `formats` such as `vertical` (1080x1920) and `square` (1080x1080). A scene written for 16:9 is scaled to fit unless it sets `window.scene.native = true` and lays itself out from `window.__format`. `captions` are beat-timed and drawn as a spring-animated overlay. A `voiceover` file is mixed over a ducked score. `studio export` writes a web MP4, WebM, poster frame and looping GIF. One scene set renders to every ad placement: vertical 1080x1920, square 1080x1080, and 16:9, plus web MP4, WebM, poster, and GIF, with captions.

## What changed and why (0.2.0)

- Gates (`studio gate`): the two-stage approval loop — stills, then animatic with sound, then full render — ported as a pattern from [Emaki](https://github.com/bypshkn/emaki) (MIT), the public code-drawn video tool with style-still and animatic gates, a critic pass and synthesized music. No gated or private skill was ported; the gate idea and the critic idea are the port, implemented on studio's own capture code.
- Attention rubric: checks baked into the reviewer prompt and mechanical proxies in the score, from [Content Principles](https://github.com/aiwithremy/content-principles) (write for one person, name the time cost, line 1 sells line 2, curiosity loops, specificity, value per second, cut the fluff, preempt the scroll-objection, frame rhythm). The skill itself says to apply these silently, so they live in the reviewer prompt and the score, not in a form the maker fills in.
- Downbeat and effect primitives (`downbeat`, `brushStroke`, `orbField`, `impactWord` in `kit/common.js`): the open-source-effects-as-code, own-music-with-downbeats, and brand-file ideas from recent motion reels, implemented as pure functions of time and seed with plain canvas, no new dependency.
- Structure templates (`prep.html`, `loop.html`, `silent.html`, `impact.html`): delivery and story shapes from recent reels — a Point/Reason/Explain/Point delivery structure, a Stakes/Big Question/Headfake/Rehook loop, a silent-film struggle-hook/timestamp/transformation shape, and a full-screen impact-text primitive with one sound per visual event.
- Format-job tagging (`job` in `project.json`): tag a film by the job it does (Storytelling, Relatable, Opinion, Advice), not just by topic.
- HyperFrames and cstack remain cited related work as before; nothing was reimplemented from them in this pass.
- Consolidation (0.2.0): studio is now the home, not just a toolbox installed elsewhere. `projects/` holds a first project, `personal/` (blackout, impact text, captions, day X/30 card), as a normal project folder, so `loop`/`render`/`sheet`/`review` work on it unchanged, including by bare name. The earlier throwaway `examples/demo/` became it, and `examples/PROMPTS.md` became `projects/PROMPTS.md`. `studio init` still works in outside repos.
- Any design system in (0.2.0): `studio init --brand-from` accepts a design-tokens JSON file, a CSS file with custom properties, or a folder of reference images and videos (a video reference becomes a poster frame via ffmpeg). The CLI already parsed `--brand-from` but never used it; it is now wired into init. No live web scraping, no Figma API, no new runtime dependencies.

## Known limits

- The browser needs to start normally. Inside a macOS app sandbox (including Claude Code's Bash sandbox) Chromium cannot start; run renders in a normal terminal or exclude `studio` from the sandbox. `studio doctor` says which.
- Renders are deterministic on one machine and Chrome version. Different Chrome or font rasterization can shift pixels.
- `studio review --auto` needs the `claude` CLI and has not been exercised against it yet.
- Studio generates the motion layer — titles, captions, impact words, fully drawn product moments — not camera or face footage. It does not replace filming a talking head; it makes the pieces that sit on top of it and the fully drawn product moments.
