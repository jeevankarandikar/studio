# projects

Studio's own first projects — real projects, not demos. They live here because
studio is the consolidated home for content creation, not a toolbox installed
elsewhere. Each is a normal studio project folder (`project.json`, `brand/`,
`scenes/`), so every command works on them unchanged:

```bash
node studio/cli.mjs lint projects/samskara
node studio/cli.mjs gate projects/samskara
node studio/cli.mjs loop projects/personal --first
node studio/cli.mjs render projects/personal --format vertical
```

Or by bare name, from the studio root: `studio loop samskara --first`
(`project.json` lookup falls back to `projects/<name>`).

- `samskara/` — product motion for Samskara marketing. Brand: light mode
  only, Apple-like, serif headline. Scenes: a menu-bar glass approval panel
  drawn as HTML (tick/untick/approve, no message bodies), then a
  question-then-verdict moment. Generic product motion, not a screenshot of
  the real app.
- `personal/` — creator motion. Brand: blackout, viashaan impact text,
  word-for-word captions (beat-timed in `project.json`), day X/30 card.
  Scenes: title + day card, dopamine loop, impact text.

`PROMPTS.md` records the prompt style behind each scene set. The brand packs
are placeholder packs (system fonts, hand-drawn marks, generated reference
frames) — replace `brand/` with the real pack per lane; the scenes stay the
same. `out/` and `.frames/` inside each project are gitignored.
