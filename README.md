# studio

Design skills, a writing guard and a video engine for coding agents. It works in Claude Code, Cursor and Codex.

## Install

```bash
git clone https://github.com/jeevankarandikar/studio.git ~/studio
```

```bash
python3 ~/studio/install.py
```

That gives you `design-jeev`, `motion`, `voice`, `log-papercut` and the writing guard in every agent it finds. Add any group from the table below by name, or take them all:

```bash
python3 ~/studio/install.py emil taste
```

```bash
python3 ~/studio/install.py --all
```

Start a new session afterwards. `git pull` updates everything, `install.py --remove` takes it out, and `install.py --project .` links skills into one repository instead of every session.

Codex skips a new hook until you trust it. Open Codex, type `/hooks`, and press `t`. Rendering video also needs the engine set up, which [docs/video.md](docs/video.md) covers.

## Which one to use

| To do this | Use | Group |
| --- | --- | --- |
| Design, build or review an interface in any stack | [`design-jeev`](skills/design-jeev) | core |
| Make a short motion video for a product | [`motion`](skills/motion) | core |
| Refuse machine-sounding prose as it is written | [`writing-guard`](writing-guard) | core |
| Write as yourself, from your own messages in a Samskara archive | [`voice`](skills/voice) | core |
| Let an agent file what got in its way, and read what others filed | [`log-papercut`](skills/log-papercut) | core |
| Audit a screen, polish it, make it bolder or quieter | [`impeccable`](skills/impeccable) | impeccable |
| Give a landing page or portfolio a real art direction | [`taste-skill`](skills/taste-skill) | taste |
| Draw a product hero, demo or bento tile | [`stageshow`](skills/stageshow) | stageshow |
| Run a whole site through Stageshow's playground and film gate at every width | [`stageshow_pass.py`](docs/stageshow-pass.md) | core |
| Study real products before designing | [`refero-design`](skills/refero-design), which needs a Refero account | refero |
| Learn the thinking behind polished UI | [`emil-design-eng`](skills/emil-design-eng) | emil |
| Build a new animation | [`animate`](skills/animate), or [`animate-expo`](skills/animate-expo) in React Native | emil |
| Find what should move and what should not | [`find-animation-opportunities`](skills/find-animation-opportunities), [`remove-animations`](skills/remove-animations) | emil |
| Review or fix motion that already exists | [`review-animations`](skills/review-animations), [`improve-animations`](skills/improve-animations), [`animation-performance`](skills/animation-performance) | emil |
| Find the word for a motion effect | [`animation-vocabulary`](skills/animation-vocabulary) | emil |
| Build gesture-driven UI the way Apple does | [`apple-design`](skills/apple-design) | emil |
| Make a web app feel native on a phone | [`mobile-native`](skills/mobile-native) | emil |
| Try several versions of one piece of UI | [`prototype`](skills/prototype) | emil |
| Break a screen with worst-case data | [`break-ui`](skills/break-ui) | emil |
| Turn the design corrections from a session into written rules | [`learn-taste`](skills/learn-taste) | emil |
| Pick a UI library, or set up toasts with Sonner | [`pick-ui-library`](skills/pick-ui-library), [`ask-sonner`](skills/ask-sonner) | emil |
| Drop in a ready-made CSS transition, or tune existing timing | `transitions-dev`, `transitions-polish`, fetched from the author when you install them | transitions |

## Mods

Five Claude Code mods sit in `mods/`. They need Claude Code 2.1.287 or later, and `python3 install.py --mods` prints the line that loads them in every session.

| To do this | Use |
| --- | --- |
| See usage limits and context fill above the prompt, with a suggestion to compact | [`fleet-gauge`](mods/fleet-gauge), which also gives Cursor and Codex a tool-call limit |
| Put a model and effort table in the system prompt and hold an agent call that names no model | [`model-routing`](mods/model-routing) |
| List every mod with whether it loaded and its last error | [`mods-pane`](mods/mods-pane) |
| Give every task a finish line, and a second look at a reply that claims a check nothing ran | [`prompt-guard`](mods/prompt-guard) |
| Hold a command once when it would spend the wrong API key, touch real data or run for hours in the foreground | [`run-guard`](mods/run-guard) |

## Guards and agent config

`guards/` holds two hooks for Claude Code, Codex and Cursor. `bash_guard.py` refuses irreversible git, dropped tables, skipped hooks and recursive `rm` outside temp and build folders. `file_guard.py` refuses files in folders you name. Both read their folders from your settings, so they hold no one's layout:

```json
"STUDIO_GUARD_BLOCKED": "~/Desktop:~/Downloads",
"STUDIO_GUARD_PROJECTS": "~/Developer/GitHub"
```

`STUDIO_GUARD_TRAILERS` set to `deny` also refuses commit trailers. `guards/skill_events.py` writes one line per skill use, with no prompt text, for `scripts/skill_report.py`.

`install.py` writes agent config too, and keeps what it replaces:

```bash
python3 install.py --guards --settings --instructions
```

`--guards` wires the two guards into every agent. `--settings` adds `settings/claude.json` and the mods to `~/.claude/settings.json`, and `--layer FILE` adds a JSON file of your own after it; a key you already set keeps its value. `--instructions` copies `~/.claude/CLAUDE.md` to Codex's `AGENTS.md` and a Cursor rule. A `VOICE_CONTEXT` value in your settings is also written to `~/.config/studio/voice-context`, so the voice skill finds your files in Codex and Cursor too. `--retire PATH` first takes out every hook, mod folder and link that points into an old kit at `PATH`.

Every run that changes a file keeps the old version under `~/.local/state/studio/history`. `install.py --history` lists them, `--diff ID` compares one with what is there now, and `--rollback ID` puts it back.

## Where things are

- `skills/` holds one folder per skill.
- `writing-guard/` holds the hook and its rules.
- `guards/` holds the Bash and file guards and the skill events hook; `settings/` holds the shared Claude Code settings.
- `studio/`, `kit/` and `templates/` are the video engine, documented in [docs/video.md](docs/video.md).
- `projects/` holds films made with it.
- `agents/` holds the subagents that `impeccable` calls.
- `mods/` holds the Claude Code mods, each with its tests.
- `skills.json` and `scripts/vendor.py` pin each third-party skill to a commit and update it.
- `scripts/check.py` runs studio's checks, the skill linter among them; `--mods` adds each mod's tests.
- `scripts/skill_report.py`, `scripts/token_report.py` and `scripts/prune_transcripts.py` read Claude Code's transcripts for tokens per skill, tokens per day and old transcripts to move to the Trash.
- `scripts/stageshow_pass.py` serves a site, links it into Stageshow's playground and runs the film gate, documented in [docs/stageshow-pass.md](docs/stageshow-pass.md).

## History

Studio began on 28 May 2026 as skill-issue, eight general skills for Claude Code. The design skill, the motion skill and the writing guard grew there until 2 November, when they moved here, and the October video engine work joined them. Both earlier lines are in this repository's log, so `git log` shows the work from the first commit.

## Credit

The design, video, voice and papercut skills, the guards, the writing guard, the mods and the engine are MIT, under [LICENSE](LICENSE). Every other skill belongs to its author and keeps its own license, which sits in its folder beside an `UPSTREAM.json` naming the source commit. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) has the full list.
