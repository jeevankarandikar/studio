# Project prompts

The prompts behind the first project in `projects/`. Short and factual, with no performance claims. Each prompt names the structure, the words on screen, and the sound. The scene files are the record of what was actually built. Words marked placeholder are placeholders: replace them with real words before anything ships.

## personal: creator motion

Brand: blackout, with a dark background, light text and one accent. The system is full-screen impact text, word-for-word captions (beat-timed in `project.json`), and a day X/30 card.

### 00-day.html: title and day card

> A day card springs in ("day 1/30", placeholder number), then a title in words, then a subline. Captions for the film are beat-timed in `project.json`, not baked into the scene.

### 01-loop.html: dopamine loop

> Stakes, Big Question, Headfake/Contrast, Rehook. Open on what is at stake, ask the big question, swap the expected card for the contrast card, and rehook with a fresh question at about two thirds through.

Timing note: the rehook delay in the file assumes a 6-beat scene at 120 bpm. Move it to about 65% of the scene length if the beats change.

### 02-impact.html: impact text

> One full-screen word per beat, each springing in large and settling, one pop sound per word, then a single subline. Nothing else on screen.

The primitive is `impactWord()` in `scenes/common.js`. One sound per word, never one per letter.

## More projects

The same tool, scene rules and commands render any project, and only `brand/` changes. For the same scenes in a different look, copy the project folder, swap `brand/`, and keep the scenes. That is cheaper than a second tool.
