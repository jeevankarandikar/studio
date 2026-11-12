# Scroll scenes

Load this for a marketing page that should show a product working instead of describing it. It builds on the framing and motion rules in `product-demos.md`. It came out of a product site prototype of 12 November 2026.

## The pattern

A scene is one stage and a few steps. The stage is the product, live or as a whole still, and it holds its place while the page scrolls. The steps are short lines that pass beside it. The step nearest the middle of the window sets what the stage shows.

A page is two or more scenes and then plain bands. Each scene makes one argument, and the visitor reads it by watching the stage change.

## The test

- Cover the words. Does the stage alone still say what the product does?
- Cover the stage. Is each step one line a person could repeat, with at most one sentence under it?
- Scroll back up. Does every step show the same thing it showed on the way down?
- Touch the stage mid-scene. Does the page stop driving it?
- Turn the script off. Does the page still read in order, with every stage in its settled frame?

## How to build it

- The stage is `position: sticky` under the header. The steps are ordinary blocks in the next column, each about one window tall, with their content centred.
- One `IntersectionObserver` with a root margin of `-45% 0px -45% 0px` watches the steps. A step that enters that band becomes the current one.
- Each step sets a whole state, never a change from the last one. A step named `redact` resets the demo, leaves the item out and redacts the figure. Scrolling up, down or straight to it then always lands on the same frame.
- The demo exposes one function that takes a step's name, and one flag that says whether a person has touched it. Scroll calls the function only while the flag is off.
- A change of step is a short fade on opacity or a transform. Dim the steps that are not current to about a third, so the eye rests on one line.
- The page's own scroll is never changed: no smooth-scroll script, no snapping, no scroll speed. Leave `scroll-behavior` alone too, since a smooth setting turns every jump from a script or a link into an animation.
- Run scenes only where there is room, such as 1000 wide and 700 tall. Below that the stage is taller than the window and sticks badly. There, hide the later steps of a live demo, and give each step of a stills scene its own still under its heading.
- Reduce Motion removes the fades. The states still change with the scroll, since a state is information.
- Every step's content is in the page from the start, and the script only shows one. The first frame is complete with no script.

## What goes on the stage

- The product's real page or a whole window, on the product's own sample data. A drawn copy drifts from the product within a release.
- A demo a visitor can operate is worth more than a film of one, because it proves the claim. Keep a line under it that says the data is sample data.
- One stage per scene. A second moving thing beside it splits the eye.

## What goes in the steps

- A step is the thing said, and its line names what the visitor is looking at. Three to five steps a scene.
- Every claim is one the product's own help or release page already makes. A step that needs a new claim waits for the feature.
- Where the product has limits, a plain band after the scenes states them in the same type.

## Checking it

- Look at every step's settled frame at the widest and narrowest sizes, in Light and Dark.
- Film one scene frame by frame through a change of step. The flaws live between the frames.
- Capture stills through a frame page. Headless Chrome will not lay a window out narrower than 500, and a page captured directly can be caught before its images have loaded. An iframe of the wanted width inside a wider window gives a true phone layout, and a virtual time budget gives the images time.
- Count the page's weight. Full-size photos in a small strip are the usual excess.

## Where this came from

The request was to make a site read the way strong product sites do: smooth scroll, little text, show and not tell. Two references shaped it: a list of galleries for scroll-driven sites, navigation bars, footers and calls to action, and a library that records real products' styles as a DESIGN.md each. The second supports a rule this skill already has, that a page's style lives in the project's `DESIGN.md` and is read from there.
