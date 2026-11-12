# Elastic feedback

Load this when a control should feel springy under the hand: a press, a toggle, a drop, a choice among a few. It extends `interaction.md`. It came from a post of 12 November 2026, a short film of four controls in black and grey with what its author called just the right amount of bounce: a download and an upload button, an analog stick, a three-way indicator and a pair of keys.

## What the film does

- The thing that takes the force is the thing that deforms. The tray bends when the arrow lands in it. The key's cap sinks toward its base. Nothing else on the screen moves.
- A shape keeps its area. What flattens gets wider, and what stretches gets thinner.
- One overshoot, small, and then rest. Nothing wobbles twice.
- A choice is shown by size among its neighbours. The chosen dot swells and the two beside it give way.
- A key has a visible base, so it reads as something that goes down before anyone presses it.
- There is no colour to lean on, so the motion carries all of the feedback, and each control still reads at rest.

## The amount

- The spring is the unit-step response of a damped spring. A damping ratio of 0.65 overshoots by about 7 percent and reads as just enough. 0.55 gives about 12 percent and reads as playful. 0.75 gives about 3 percent and is nearly invisible.
- The press goes down fast, about 80 milliseconds on an ease-out, and comes back on the spring over about 420.
- Scale a pressed control to about 0.95. Below 0.9 a control looks broken.
- One spring token for the whole surface. Two springs with different bounce read as two products.

## Where it belongs

- On the control the person has just acted on, as the answer to that action.
- On a first impression, a demo, a game, a small tool. A marketing page can afford it.
- Leave it off anything used all day, off page and window changes, off text, and off anything that moves without the person's hand. A spring on the hundredth press is a delay.
- A project that follows a platform canon keeps the platform's own press feedback in the product, and may still use this on the product's site.
- A control the page changes by script does not bounce. Only the person's own press does.
- Reduce Motion removes it. The state still changes at once.

## How to build it

- In CSS, sample the spring into `linear()` and keep a `cubic-bezier` with a little overshoot as the value for a browser without it:

```css
:root { --spring: cubic-bezier(.34, 1.4, .64, 1); --t-spring: .42s; }
@supports (transition-timing-function: linear(0, 1)) {
  :root { --spring: linear(0, .059 5.6%, .198 11.1%, .372 16.7%, .547 22.2%, .705 27.8%, .834 33.3%,
    .931 38.9%, .999 44.4%, 1.041 50%, 1.062 55.6%, 1.068 61.1%, 1.064 66.7%, 1.055 72.2%,
    1.043 77.8%, 1.031 83.3%, 1.021 88.9%, 1.012 94.4%, 1); }
}
.button { transition: transform var(--t-spring) var(--spring); }
.button:active { transform: scale(.95); transition-duration: .08s; transition-timing-function: ease-out; }
```

- The points come from x(t) = 1 - e^(-zt) (cos(dt) + (z/d) sin(dt)) with d = sqrt(1 - z^2), sampled until it rests within half a percent. Change z and sample again for another amount.
- A state change that is not a press, such as a box ticking, gets a class when the person changes it and loses the class when the animation ends. A plain `:checked` animation would also run when the page first draws.
- Animate transform and opacity only. An inline element needs `display: inline-block` before a transform applies to it.
- For squash and stretch, scale one axis up as the other goes down, from the edge that stays put: a key squashes from its base, so its `transform-origin` is the bottom.
- In SwiftUI the same amount is `.spring(response: 0.42, dampingFraction: 0.65)`, and in a motion library a spring with a bounce of about 0.25.

## Checking it

- Film the press and step through the frames. The overshoot should be one frame or two past rest and never a second swing.
- Press it ten times fast. It should take every press and never queue.
- Turn Reduce Motion on and press again.
