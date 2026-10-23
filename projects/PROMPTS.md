# Project prompts

The prompts behind the two first projects in `projects/`. Short, factual, no
performance claims. Each prompt names the structure, the words on screen, and
the sound; the scene files are the record of what was actually built. Words
marked placeholder are placeholders — replace them with real words before
anything ships. Nothing here claims how a scene performs.

## samskara/ — product motion

Brand: light mode only, Apple-like, serif headline. The brand pack is a
placeholder pack (DejaVu serif/sans, hand-drawn wordmark, generated reference
frames); a real Samskara pack replaces it, same folder shape.

### 00-panel.html — the approval panel

> A glass panel drops from the menu bar. It lists exactly which sources it
> wants to read — Texts, Snapchat, Instagram, Notes — checks tick in one by
> one, one row is deliberately unticked, then Approve springs in. No message
> bodies on screen, ever.

The row labels and the tick/untick/approve shape are the established demo
mechanic; the panel is drawn as HTML, not a screenshot of the real app.

### 01-verdict.html — question, then verdict

> A question types in as words, then a verdict line, then one subline. Serif
> headline, light background, one sound per beat.

The question/verdict shape is the flagship demo shape. The words in the file
are placeholders for the real demo's words.

## personal/ — creator motion

Brand: blackout — dark background, light text, one accent. The viashaan
system: full-screen impact text, word-for-word captions (beat-timed in
`project.json`), and a day X/30 card.

### 00-day.html — title + day card

> A day card springs in ("day 1/30", placeholder number), then a title in
> words, then a subline. Captions for the film are beat-timed in
> `project.json`, not baked into the scene.

### 01-loop.html — dopamine loop

> Stakes, Big Question, Headfake/Contrast, Rehook. Open on what is at stake,
> ask the big question, swap the expected card for the contrast card, and
> rehook with a fresh question at about two thirds through.

Timing note: the rehook delay in the file assumes a 6-beat scene at 120 bpm.
Move it to about 65% of the scene length if the beats change.

### 02-impact.html — impact text

> One full-screen word per beat, each springing in large and settling, one pop
> sound per word, then a single subline. Nothing else on screen.

The primitive is `impactWord()` in `scenes/common.js`. One sound per word,
never one per letter.

## One project, two brand packs — and two projects

The point of the brand-pack-per-project design is that the same tool, the same
scene rules, and the same commands render both lanes; only `brand/` changes.
If a lane ever needs just a different look for the same scenes, copy the
project folder, swap `brand/`, and keep the scenes — that is the split, and
it is cheaper than a second tool.
