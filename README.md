# studio

A toolbox that turns HTML scenes into motion videos, for any repo, project or product. It holds no projects. A video project is a folder inside the repo it is for, and `studio` renders it.

Scenes are plain HTML, CSS and JavaScript. Playwright captures every frame in headless Chrome, FFmpeg stitches the frames with a synthesized score into an MP4, and a critique loop scores each scene and flags the weak ones.

Other tools do part of this: [HyperFrames](https://github.com/heygen-com/hyperframes) renders HTML to video for agents, and Remotion, Motion Canvas and Revideo are code-first video frameworks. This one adds a fixed motion rule set (closed-form springs, no CSS transitions) and the score-and-review loop.

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

## Use it in a repo

```bash
cd ~/code/my-product
studio init                      # creates ./motion with a brand pack taken from the repo
studio loop motion --first       # render all scenes, score them
studio sheet motion 0            # 8-frame contact sheet of one scene, in seconds
```

`studio init` reads the repo for a logo, font files, CSS color variables, reference images and screenshots, and the name and description from `package.json`. It reports what it found and what is missing. Nothing is invented: a missing font or reference image stops the render with a message.

The project folder carries its own `AGENTS.md` with the scene rules and commands, so an agent working in that repo knows how to author and render without reading this file.

## Commands

| command | does |
|---|---|
| `studio init [dir]` | make a project in the current repo (default `./motion`) |
| `studio loop <project> [--first] [--review]` | render, score, re-render weak scenes |
| `studio render <project> [--scene N] [--format name]` | render and stitch |
| `studio sheet <project> <scene>` | contact sheet for one scene |
| `studio watch <project> <scene>` | rebuild the sheet on every save |
| `studio frame <project> <scene> <frame>` | one frame as a PNG |
| `studio lint <project>` | motion rules, no browser needed |
| `studio review <project> [--auto]` | reviewer brief, or run it through `claude -p` |
| `studio export <project>` | web MP4, WebM, poster and GIF |
| `studio check <project>` | same frame twice must be byte-identical |
| `studio doctor` | diagnose the environment |

A `<project>` is a path to a folder with a `project.json`, or a name found under `./motion/`.

## A project

```
motion/
  project.json     bpm, fps, size, scenes in beats, extra formats, captions, optional voiceover
  brand/           colors.json, fonts/ (+ fonts.json), logo.svg|png, refs/ (2+), shots/
  scenes/          NN-name.html, common.js, common.css
  out/  .frames/   gitignored
```

The render refuses to run until the brand pack loads: palette, at least one font, a logo, and two reference frames.

## The rules

- Time only comes from `render(t, frame, ctx)`. Lint rejects `Date`, `setTimeout`, `requestAnimationFrame` and `Math.random`.
- Motion is a closed-form damped spring, `spring(t - delay, { from, to, k, c, m })`, never an easing curve. Lint rejects CSS `transition`, `animation`, `@keyframes` and easing keywords.
- Scene lengths are in beats, so cuts land on the beat. 120 bpm at 30 fps gives 15 whole frames per beat.
- Audio is synthesized from the bpm; there is no stock music.
- No centered all-caps text on a gradient.

## Scoring and review

Each scene starts at 10. Points come off for dead frames (8 or more near-identical frames in a row), low motion density, a cut off the beat and lint hits. `studio review --auto` hands the contact sheets and `studio/critique/rubric.md` to a fresh-context model that sees nothing of how the scenes were built, and its score can only lower the mechanical one. Every scene needs 8 or more.

## Formats and delivery

`project.json` can list `formats` such as `vertical` (1080x1920) and `square` (1080x1080). A scene written for 16:9 is scaled to fit unless it sets `window.scene.native = true` and lays itself out from `window.__format`. `captions` are beat-timed and drawn as a spring-animated overlay. A `voiceover` file is mixed over a ducked score. `studio export` writes a web MP4, WebM, poster frame and looping GIF.

## Known limits

- The browser needs to start normally. Inside a macOS app sandbox (including Claude Code's Bash sandbox) Chromium cannot start; run renders in a normal terminal or exclude `studio` from the sandbox. `studio doctor` says which.
- Renders are deterministic on one machine and Chrome version. Different Chrome or font rasterization can shift pixels.
- `studio review --auto` needs the `claude` CLI and has not been exercised against it yet.
