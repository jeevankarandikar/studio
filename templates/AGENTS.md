# Video project

This folder makes videos for the repo it lives in. The `studio` tool renders it. Nothing here is generated at run time: scenes are plain HTML you edit.

## Commands

```bash
studio doctor                        # once: checks node, ffmpeg, the browser
studio lint .                        # motion rules, no browser needed
studio loop . --first                # render every scene, score them, write out/<name>/report.json
studio loop .                        # re-render only scenes under 8
studio sheet . 2                     # 8-frame contact sheet of scene 2 in seconds (out/<name>/preview/)
studio watch . 2                     # same, again on every save
studio frame . 2 40                  # one frame as a png
studio review . --auto               # fresh-context reviewer scores the contact sheets
studio render . --format vertical    # 1080x1920 (square is 1080x1080)
studio export .                      # web mp4, webm, poster and gif in out/<name>/web/
studio check .                       # same frame twice must be byte-identical
```

## Rules for scenes

- Time comes only from `render(t, frame, ctx)`. No `Date`, `setTimeout`, `requestAnimationFrame` or `Math.random`.
- All motion is `spring(t - delay, { from, to, k, c, m })` or a preset (`spring.snappy`, `spring.soft`, `spring.bouncy`). No CSS transitions, animations or easing curves. `studio lint` fails the render if any appear.
- Scene lengths are beats in `project.json`. At 120 bpm and 30 fps one beat is 15 frames, so every cut lands on the beat.
- Colors and fonts come from `brand/` as CSS variables and font families. Do not hardcode brand colors in scenes.
- No frame may sit still. Use `kick(ctx)` for a spring on every beat and `ambient()` for background drift.
- Left-aligned layouts. No centered all-caps text on a gradient.
- Real product screenshots go in `brand/shots/`. List each scene's required files under `needs` in `project.json`.
- Layout helpers are in `scenes/common.js`: `wordsIn`, `typeText`, `countUp`, `card`, `shotFrame`, `parallax`, `prepPath`/`drawPath`, `kick`, `ambient`.

## The loop

Render, read `out/<name>/report.json`, open the contact sheets in `out/<name>/sheets/`, fix the weakest scene, render again. A scene passes at 8. The reviewer (`studio review . --auto`) can only lower a score, and its notes name the frame and the defect.

## Output

`out/` and `.frames/` are gitignored. Commit scenes and `brand/`.
