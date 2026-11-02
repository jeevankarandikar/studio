# Product demos and shown UI

For anything that shows a product rather than being the product: a website hero, a film, a bento tile, an onboarding illustration, a docs diagram, a screenshot placed on a page. The last section says what carries over to real screens.

The method comes from Stageshow by Benji Taylor (MIT, github.com/benjitaylor/skills). These are its rules in our words. Read the original for the examples. Do not copy its `kit/phone.*`, `kit/ios.*` or `assets/app-icons.ts` into a project that keeps Apple's design resources out: the phone frame follows Apple's UI kit, its screen corner is traced from Apple's product bezel, and the icons are app-bundle artwork outside the MIT license.

## The test

It reads as a real product, simplified to what the viewer needs, framed with intent, and every motion has a cause.

Five ways it fails:

- Too much: real words in every cell, numbers everywhere, packed tight. More detail looks more generated.
- Wireframe: two grey blobs and a button.
- Boxed: a whole window shrunk into a card with even margins, like a pasted screenshot.
- Flat: every object the same weight in the same bordered card, so the eye has nowhere to land.
- Bland: a grey window with a cursor, whatever the brief asked for.

The fix is a full, structured screen in quiet greys, real words only on what the story is about, placeholder lines for the rest, and a crop that puts the eye on the story. Simplify the words and keep the context. An empty corner, a void under a list, rows spread to fill a pane or a window floating on a plate all read as unfinished.

## Order of work

Most of the quality is decided before code. Write this down first: where it sits, the focal object, the action, the payoff, what can be left out.

1. Medium and place: still or animation, the page, the ground, the shown width. Design at that size.
2. Look: map the product's own tokens. A demo sits beside the real product, so it uses the real colours, type and radii.
3. Story: pick the shape. How it feels to use, a flow through the app, or what the system does on its own. Three to five beats and a payoff, 10 to 16 seconds for a hero loop.
4. Start from the closest strong example and hold your work against it.
5. Screen: count the real strings, usually three to seven. That budget covers words, not elements.
6. Choreograph: overlap beats, stagger groups, hold the payoff, end the loop where it began or reset with a visible cause.
7. Rehearse: set the poster frame first, because most people only see that frame. Then film the loop.

## Framing

- One hero object and at most two satellites, of different kinds and sizes.
- Decide the crop before building, because a crop needs nothing past it.
- The hero fills at least two thirds of the stage and 10 to 40 percent of it runs off an edge. Crop only filler: the payoff, the action and every real word stay whole. A button, chip or shadow sliced by the stage is the usual fault.
- A satellite straddles the hero's edge, about half outside, over chrome and never over content.
- One gutter: every edge distance in the final crop matches it, and a crossing is either a full gutter or well past.
- A bento tile starts as pinned, bottom bleed: inset 8 to 12 percent on three sides, 15 to 35 percent past the bottom. A hero beside copy starts as corner bleed.
- Tiles in a grid differ: one hero, one window, a stat, an object, a diagram. The same card four times is flat.
- A whole window with even gutters stays valid when its contents read and the brief asks for it.

## Still frame

- Words sit where the eye lands, grey bars at the edges and off the crop.
- A label beside a real value is two words or neither.
- Padding 12px, 8px dense. Add rows before adding air.
- No stock AI: sparkles, purple, a letter in a coloured square.
- A status bar, device or window chrome drawn by hand reads as made up. Use the product's real chrome and nothing a native app would not have.

## Motion

- Every change has a cause on screen: a cursor, a finger, or a system event the viewer can trace.
- Nothing pops. Keep what appears mounted and toggle it, so it leaves as well as it arrives.
- Animate the relationship: a new row carries the rows below it. A surface that resizes never stretches its text.
- Change only what changed. A number rolls the digits that moved. Text that updates moves rather than swaps.
- Data never rewinds in view without a cause.
- The cursor moves like a hand: shallow arcs timed by distance, presses you can see, never over the label it clicks.
- Two curves are enough. Feedback is fast, the payoff holds.
- Reduced motion gets the poster frame or a short fade, with the same information.

## Rehearse by filming

A screenshot of the settled page hides the bugs, which live in between: a pill hopping 4px on its way in, one frame where everything has faded out, a one-frame snap.

- Film the whole loop to a contact sheet at the shown width and at 390, and read every frame.
- Step through each press, flight and handoff, then watch the seam where the loop restarts.
- Hold the result next to the closest strong example. If yours is the emptier or flatter one, fix that first.
- Say what you did not watch.

## On real screens

The product's own screens follow the platform and `DESIGN.md`. Cropping, cursors, placeholder lines and loops stay on shown UI. These carry over:

- Every motion has a cause, and the person's action is that cause.
- Keep things mounted so they can leave, and let a change carry its neighbours.
- Change only what changed, and never stretch text during a resize.
- No void under a list, no fat rows, no rows spread to fill a pane, one gutter.
- A screen that shows a sample, such as a first run step, an empty state or a help image, is shown UI, and this whole page applies to it.
