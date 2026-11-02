# design-jeev

`design-jeev` is a design skill for Claude Code, Cursor and Codex. It works in whatever stack the project already uses: web, SwiftUI, AppKit, UIKit, Compose, Flutter, React Native or a terminal UI.

It runs interface work in stages, and each stage hands a written result to the next through a `DESIGN.md` file in your repository.

| Stage | Ask for it like this | What you get |
| --- | --- | --- |
| Explore | "explore a direction for the settings screen" | The skill draws several directions on a design canvas such as Claude Design, or builds two in your own stack, and writes the one you choose into `DESIGN.md`. |
| Ship | "build it", "polish the sidebar" | The skill makes the change in your code with your tokens, renders it, and looks at every screen size and control state the change touches. |
| Review | "review this before release" | A fresh agent runs a pass or fail checklist on the rendered interface and ranks what it finds from P0 to P2. |

When a project has no interface yet, the skill picks an approach by use case before writing anything. The table it uses is in [choosing.md](references/choosing.md).

The judgment behind the stages lives in reference files the skill loads only when the work touches them:

| Reference | What it holds |
| --- | --- |
| [principles.md](references/principles.md) | How Apple, Google, Meta, OpenAI, Anthropic, Superhuman, Linear, Stripe, Vercel and Airbnb say they design, where they disagree, and how to choose |
| [lenses.md](references/lenses.md) | Ten designers to reason from, sixteen UX laws, the disclosure ladder |
| [craft.md](references/craft.md) | Type, color, spacing, hierarchy and depth |
| [interaction.md](references/interaction.md) | Control states, forms, waiting, overlays, keyboard, motion timing, first run |
| [words.md](references/words.md) | Interface text |
| [data-viz.md](references/data-viz.md) | Chart choice and palettes that survive color blindness |
| [product-demos.md](references/product-demos.md) | Anything that shows a product instead of being it: heroes, films, bento tiles, onboarding art, screenshots on a page |
| [verticals.md](references/verticals.md) | What money, developer, business, health, shop, AI and consumer products each demand |
| [critique.md](references/critique.md) | Heuristic scoring and the signs of a generic look |

It works beside a company or brand design skill and defers to it on brand. Name that skill under Canon in the repository's `DESIGN.md`.

`DESIGN.md` records the guidelines the project follows (Apple's, Material, or its own), its tokens, its licensed and banned assets, its surfaces and its decisions. The skill drafts one from your code the first time, using [this template](references/design-md-template.md).
