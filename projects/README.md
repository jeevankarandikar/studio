# projects

Studio's own first project. It lives here because studio is the home for content creation, not only a toolbox installed elsewhere. It is a normal studio project folder (`project.json`, `brand/`, `scenes/`), so every command works on it unchanged:

```bash
node studio/cli.mjs lint projects/personal
node studio/cli.mjs gate projects/personal
node studio/cli.mjs loop projects/personal --first
node studio/cli.mjs render projects/personal --format vertical
```

Or by bare name, from the studio root: `studio loop personal --first` (`project.json` lookup falls back to `projects/<name>`).

- `personal/` is creator motion. Brand: blackout, impact text, word-for-word captions (beat-timed in `project.json`), a day X/30 card. Scenes: title and day card, dopamine loop, impact text.

`PROMPTS.md` records the prompt style behind the scene set. The brand pack is a placeholder pack (system fonts, a hand-drawn mark, generated reference frames). Replace `brand/` with the real pack and the scenes stay the same. `out/` and `.frames/` inside a project are gitignored. A project that should stay private lives in its own repo and is not committed here.
