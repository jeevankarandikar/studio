# Video project

This folder makes videos for the repo it lives in. The `studio` tool renders it. Nothing here is generated at run time: scenes are plain HTML you edit.

## Commands

```bash
studio doctor                        # once: checks node, ffmpeg, the browser
studio lint .                        # motion rules, no browser needed
studio loop . --first                # render every scene, score them, write out/<name>/report.json
studio loop .                        # re-render only scenes under 8
studio gate .                        # stills first, then animatic, then full render — approval in out/<name>/gates/approval.json
studio sheet . 2                     # 8-frame contact sheet of scene 2 in seconds (out/<name>/preview/)
studio watch . 2                     # same, again on every save
studio frame . 2 40                  # one frame as a png
studio review . --auto               # fresh-context reviewer scores contact sheets, cut strips and peak-motion strips
studio review . --mute --auto        # mute test: a judge sees the film with no sound and says what it understood
studio verify .                      # loudness, size, first and last frame; writes out/<name>/manifest.json
studio sfx --all                     # write every sound effect to ./sfx-audition/ to listen
studio render . --format vertical    # 1080x1920 (square is 1080x1080)
studio export .                      # web mp4, webm, poster and gif in out/<name>/web/
studio check .                       # same frame twice must be byte-identical
```

## Rules for scenes

- Time comes only from `render(t, frame, ctx)`. No `Date`, `setTimeout`, `requestAnimationFrame` or `Math.random`.
- All motion is `spring(t - delay, { from, to, k, c, m })` or a preset (`spring.snappy`, `spring.soft`, `spring.bouncy`). No CSS transitions, animations or easing curves. `studio lint` fails the render if any appear.
- Scene lengths are beats in `project.json`. At 120 bpm and 30 fps one beat is 15 frames, so every cut lands on the beat.
- Colors and fonts come from `brand/` as CSS variables and font families. Do not hardcode brand colors in scenes.
- A brand pack comes from `studio init`'s repo scan, or from `--brand-from`: a design-tokens JSON file (colors, fonts), a CSS file with custom properties, or a folder of reference images and videos (a video reference becomes a poster frame in `brand/refs/`). A website or app as input means pointing init at that site/app's repo or exported assets — no live scraping, no Figma API.
- No frame may sit still. Use `kick(ctx)` for a spring on every beat and `ambient()` for background drift.
- Left-aligned layouts. No centered all-caps text on a gradient.
- Real product screenshots go in `brand/shots/`. List each scene's required files under `needs` in `project.json`.
- Layout helpers are in `scenes/common.js`: `wordsIn`, `typeText`, `countUp`, `card`, `shotFrame`, `parallax`, `prepPath`/`drawPath`, `kick`, `downbeat` (a kick on bar starts only), `brushStroke` (textured canvas stroke along a path), `orbField` (seeded drifting particle orbs), `impactWord` (a full-screen word that springs in and settles), `ambient`.
- Structure templates, copied from `templates/` into a project and edited: `prep.html` (PREP: Point, Reason, Explain, Point restated), `loop.html` (dopamine loop: Stakes, Big Question, Headfake/Contrast, Rehook around 65%), `silent.html` (silent-film: struggle hook, payoff-promising timestamp, transformation beat, on-screen text only), `impact.html` (impact text: one full-screen word per beat, one sound per word). `title.html`, `shot.html` and `close.html` are the ones `studio init` scaffolds.

## Sound

Audio is synthesized. A score is built from the bpm. Sound effects come from `studio sfx` (run it to list them, `studio sfx --all` to write them to `./sfx-audition/` and listen): click, key, type, tick, pop, whoosh, swipe, settle, thud, hit, riser, chime, success, error, blip, shutter.

- A scene declares its sounds next to its visuals: `window.scene.sfx = [{ t: 0.25, name: 'pop' }]`, with `t` in seconds from the scene start and an optional `gain` (default 0.5). Use the same delay constants that place the visual, so moving a visual moves its sound.
- `type` is a burst of keystrokes: `{ t: 0.6, name: 'type', dur: 1.3, cps: 28 }` for a typing field that types at 28 characters a second.
- `project.json` can set `"cutSfx": "whoosh"` for a sound just before every cut, and `"sfx": [{ "beat": 4, "name": "riser" }]` for sounds placed by beat.
- Fewer sounds, each earning its place. One sound per visual event that matters. Never put a sound on every word.

## The loop

Render, read `out/<name>/report.json`, open the contact sheets in `out/<name>/sheets/`, fix the weakest scene, render again. A scene passes at 8. The reviewer (`studio review . --auto`) can only lower a score, and its notes name the frame and the defect.

## Output

`out/` and `.frames/` are gitignored. Commit scenes and `brand/`.
