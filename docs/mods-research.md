# Claude Code mods research

18 November 2026

Scope: public plugins, hooks, status lines, routers and usage tools worth borrowing from, plus what Claude Code itself exposes. Star counts are what each GitHub page showed on 18 November 2026. Where a page showed no commit date, the entry says "last update not shown". Anything I could not open directly is marked unverified.

The mods it was written for: fleet-gauge (weekly cap, context fill, subagent call counts), model-routing (routing table in the system prompt plus a nudge when an Agent call names no model), run-guard (holds a risky test command once).

## What Claude Code exposes

Sources: https://code.claude.com/docs/en/statusline, https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/costs, https://code.claude.com/docs/en/model-config

### Status line stdin JSON

The command receives one JSON object on stdin. Fields that matter for usage:

- `context_window.total_input_tokens` and `context_window.total_output_tokens`: tokens currently in the window, from the most recent API response. Input includes cache reads and writes.
- `context_window.context_window_size`: maximum window in tokens.
- `context_window.used_percentage` and `context_window.remaining_percentage`: precomputed, may be `null` early in a session. The percentage uses input tokens only (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`), not output.
- `context_window.current_usage`: per-category counts from the last API call. It is `null` before the first call and again after `/compact` until the next call.
- `exceeds_200k_tokens`: fixed 200k threshold, whatever the real window is.
- `rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`: 0 to 100.
- `rate_limits.five_hour.resets_at` and `rate_limits.seven_day.resets_at`: Unix epoch seconds.
- `rate_limits.spend_limit.used_percentage`, `.resets_at`, and optionally `.used_usd`, `.limit_usd`, `.period` (daily, weekly or monthly): only behind a Claude apps gateway that sets a spend limit.
- `cost.total_cost_usd`, `cost.total_duration_ms`, `cost.total_api_duration_ms`, `cost.total_lines_added`, `cost.total_lines_removed`. The dollar figure is computed locally at list price and resets on `/clear`.
- `prompt_cache` object (hit ratio, misses, warm or cold), absent until the first API response. Needs v2.1.251 or later.
- `effort.level` (low, medium, high, xhigh, max), `thinking.enabled`, `model`, `session_id`, `workspace.current_dir`.

Rules the docs state:

- `rate_limits` appears only for claude.ai Pro, Max and Ultra subscribers, or behind a gateway with a spend limit, and only after the first API response of a session. Each window can be absent on its own, and Claude Code drops a window once its `resets_at` has passed.
- The script reruns on events, when a rate-limit window in the last data reaches its `resets_at`, and on a timer if `refreshInterval` is set (minimum 1 second).
- If `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set, `used_percentage` still measures against the model's full window, so it no longer tells you when compaction will run.

Not exposed to the status line, as far as the docs show:

- Per-model weekly buckets (Opus, Sonnet) as separate fields. ccstatusline lists such widgets, so they come from somewhere else (unverified where).
- Usage credits balance, monthly credit spend or monthly spend limit for a Pro, Max or Ultra user. The docs place these in `/usage` and `/usage-credits` only. The only spend-limit fields in the JSON belong to the gateway case.
- Subagent call counts. Nothing in the JSON lists them, so fleet-gauge has to count from hooks.

### Hook input

Every hook gets `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort` (object with `level`) and `hook_event_name`. `agent_id` and `agent_type` appear inside subagents. `model` is documented only for `SessionStart`.

- The docs I read list no token, context or rate-limit field in hook input. The `transcript_path` file is the only route to token counts from a hook, and the docs say it is written asynchronously and may lag the current turn. I read 100,000 of 294,376 characters of the hooks page, so a field in the unread part is possible (unverified).
- `StopFailure` takes a `rate_limit` matcher. `Notification` matchers include `quota_auto_resume_fired`, `quota_auto_resume_stale` and `quota_auto_resume_disabled`.
- Events include `PreCompact` and `PostCompact`, `PreModelSwitch` and `PostModelSwitch`, `SubagentStart` and `SubagentStop`, `UserPromptSubmit`, `PreToolUse`, `SessionStart`.
- `PreCompact` matcher values are `manual` and `auto`. Exit code 2 blocks compaction, and `decision: "block"` with a `reason` also applies. On exit 0, plain stdout becomes instructions for the compaction summary.
- `SessionStart` hooks that match source `compact` run after compaction and their output is added to the compacted context.

### Slash commands and settings for compaction and usage

- `/usage` shows plan usage bars, an attribution breakdown (skills, subagents, plugins, MCP servers), recommendations, and a usage-credits row while credits are on. It shows the last known data for up to 60 minutes if the usage request fails. Figures are computed from local session history on this machine.
- `/usage-credits` opens claude.ai settings for credits (balance, month spend, spend limit).
- `/context` gives a live breakdown by category.
- `/autocompact 500k` sets the auto-compact window for the current model, accepting 100K to 1M. Saved under `modelSettings`. `autoCompactWindow` in settings applies to every model. `--autocompact` applies to one launch. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` overrides all of them. Claude Code caps the value at the model's window.
- Default behavior: models with a native 1M window compact at about 967K tokens unless a smaller window is set.
- `idleCompaction` is a setting that compacts a conversation left idle.
- `autoContinueAtUsageLimit` setting and the `/rate-limit-options` command cover waiting for a reset (v2.1.234 or later).
- Model controls: `/model`, aliases `opus`, `sonnet`, `haiku`, `fable`, `opusplan`, and `[1m]` variants. `CLAUDE_CODE_SUBAGENT_MODEL` sets the default subagent model, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` forces one model for all. Effort comes from `CLAUDE_CODE_EFFORT_LEVEL`, `/effort`, `--effort`, `effortLevel`, or skill and subagent frontmatter. Opus 5.5, Sonnet 5.5 and Haiku 5.5 always think and have levels low through max.

No documented shell hook or setting runs `/compact` for you at a threshold. A mod's hooks module can: `$.session.compact({ instructions })` raises the same compaction `/compact` makes, between turns, and `$.session.usage({ breakdown: 'summary' })` reads the engine's `autoCompactThreshold` and `isAutoCompactEnabled` (Claude Code 2.1.325 types). fleet-gauge's optional auto-compact uses that call. A slash command cannot be called from a shell hook, and a community report on the Claude Code issue tracker says auto-compact warnings still need the user (unverified, search snippet only). `/autocompact` plus `PreCompact` and `SessionStart` with source `compact` are the supported tools.

## Usage and limits

### ccusage

- Link: https://github.com/ryoppippi/ccusage (19.5k stars, last update not shown)
- Reads local session logs and reports daily, weekly, monthly and session cost, plus a 5-hour billing-window report. Has a beta `ccusage statusline` for Claude Code.
- Verdict: copy an idea. Use its block-by-block reporting from local logs as a cross-check for per-session cost, but our weekly percentage should come from `rate_limits`, which ccusage does not read.

### Claude Code Usage Monitor

- Link: https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor (8.8k stars, last update not shown, README mentions v4.0.0)
- Terminal monitor with burn rate and run-out predictions. It prefers official statusline `rate_limits` data when fresh and labels anything else as a local estimate. Has `--once`, `--compact` and `--write-state` for scripts, with exit codes for near-limit.
- Verdict: copy an idea. The rule of labeling a number "official" or "estimate" is what an honest usage view needs. Its burn-rate forecast is worth copying for "weekly 99%, resets in N hours".

### claude-usage by Dede98

- Link: https://github.com/Dede98/claude-usage (stars and date unverified)
- Per a search snippet, it reads the OAuth token and makes a one-token API call to obtain session and weekly percentages.
- Verdict: skip. Reading the credential store is unnecessary now that `rate_limits` is in the status line JSON.

### claude-limit-statusline

- Link: https://www.pkgstats.com/pkg:claude-limit-statusline (package index page only; repo and stars unverified)
- Shows 5-hour and 7-day windows with a live countdown, per the index listing.
- Verdict: skip. Nothing it does goes beyond the documented `rate_limits` fields.

### Built-in /usage and /context

- Link: https://code.claude.com/docs/en/costs
- Official plan bars, attribution by skill, subagent, plugin and MCP server, and credits row.
- Verdict: adopt as the source of truth. Our usage view should mirror these categories and say which numbers come from `/usage` only (credits).

## Status lines

### ccstatusline

- Link: https://github.com/sirmalloc/ccstatusline (13.6k stars, last update not shown, README names v2.2.34)
- Configurable powerline status line with a terminal UI. Widgets include context length, context percent, context bar, Block Usage, Block Reset Timer, Block Forecast, Weekly Usage, Weekly Reset Timer, Weekly Sonnet and Opus usage, Extra Usage, Spend Limit, Cache Hit Rate, Cache If Cold, Compaction Counter and Thinking Effort.
- Verdict: copy an idea. "Context % (usable)" next to plain "Context %" answers the problem that `used_percentage` ignores a custom compact window. Also copy "Cache If Cold" and "Compaction Counter".

### claude-hud

- Link: https://github.com/jarrodwatts/claude-hud (29.2k stars, last update not shown)
- Plugin that puts a two-line view below the input: model, path, branch, then context usage and subscriber rate limits, with optional lines for tools, running agents and todo progress. Installed through `/plugin marketplace add jarrodwatts/claude-hud`, then `/hud`. Needs Claude Code 2.1.260 or later and Node 22.18 or later.
- Verdict: copy an idea. The `/hud` setup command that points the status line at the plugin is a clean model for our mods pane. Adopting it whole would overlap fleet-gauge.

### Official status line examples

- Link: https://code.claude.com/docs/en/statusline
- The docs ship working bash, Python and Node scripts for a context bar, cost and duration, git state, and rate limits, plus the caching advice to key cache files on `session_id` rather than a process id.
- Verdict: adopt. Start from the rate-limit example and the `session_id` caching pattern.

## Compaction and context

### everything-claude-code (strategic-compact and context-gate)

- Link: https://github.com/affaan-m/everything-claude-code (about 306.4k stars, last update not shown, README names 2.2.3)
- A very large harness. Relevant pieces: `scripts/hooks/suggest-compact.js` (suggests compaction by tool-call count, default 50 then every 25, via `COMPACT_THRESHOLD`, per search results), `pre-compact.js`, and `context-gate.js`, an opt-in checkpoint-and-restart gate at 90% context that is advisory unless `ECC_CONTEXT_GATE_MODE=enforce`. Hook strictness is set by `ECC_HOOK_PROFILE` and individual hooks are switched off with `ECC_DISABLED_HOOKS`.
- Verdict: copy an idea. Take the advisory-by-default gate with an enforce switch, and the per-hook disable list. Skip the tool-call-count trigger, since we have real context percentage.

### PreCompact and SessionStart(compact) hooks

- Link: https://code.claude.com/docs/en/hooks
- A `PreCompact` hook can add summary instructions through stdout or block compaction. A `SessionStart` hook matching `compact` can re-inject facts after.
- Verdict: adopt. Use PreCompact to tell the summarizer to keep the current task, open files and the model routing table, and SessionStart(compact) to restore anything the summary drops.

### /autocompact and autoCompactWindow

- Link: https://code.claude.com/docs/en/model-config
- The supported way to compact earlier than 967K on a 1M window. Per-model values live in `modelSettings`.
- Verdict: adopt for the optional auto-compact feature. A settable threshold in our mod can write the window through settings instead of inventing a second mechanism. The status line percentage does not move with it.

### Feature requests for a native threshold

- Links: https://github.com/anthropics/claude-code/issues/41818 and https://github.com/anthropics/claude-code/issues/46695 (found in search results, not opened)
- Requests for a configurable compaction percentage and a pre-compact threshold hook. Outcome unverified, and `/autocompact` may now cover part of this.
- Verdict: skip as a dependency. Worth reading before building to avoid duplicating a shipped feature.

## Model routing

### claude-code-router

- Link: https://github.com/musistudio/claude-code-router (38.2k stars, last update not shown, README names v3.1.5)
- Local gateway between the client and providers, with routing conditions on headers and bodies, prefixes, rewrites, retries and ordered fallbacks, plus request logs. I could not confirm its route names (for example background or long context) from the README page.
- Verdict: skip. A proxy changes the transport and risks the subscription path; our routing should stay in-session through hooks and settings.

### LiteLLM

- Link: https://github.com/BerriAI/litellm (63.5k stars, last update not shown)
- Gateway exposing 100+ providers in one OpenAI-style interface, with spend management per project and user. The README says Claude Code can be pointed at it.
- Verdict: skip. Built for API billing and teams, not for a subscription with a weekly cap.

### Built-in routing controls

- Link: https://code.claude.com/docs/en/model-config
- `opusplan` (Opus in plan mode, Sonnet for execution), `CLAUDE_CODE_SUBAGENT_MODEL`, a `model` field in subagent definitions, `effort` frontmatter on skills and subagents, `PreModelSwitch` and `PostModelSwitch` hook events.
- Verdict: adopt. Extend model-routing to set subagent model and effort through frontmatter and the env variable, and use `PostModelSwitch` to log switches into the gauge. The weekly limit is shared across models, so switching does not lift it, but after a model-family limit message (Opus or Sonnet) a model outside that family keeps you working.

## Safety hooks

### claude-code-safety-net

- Link: https://github.com/kenryu42/claude-code-safety-net (2.1k stars, last update not shown)
- Pre-execution guard that blocks destructive git commands, recursive deletes on dangerous targets, piped install scripts and reads of SSH keys or `.env` files. It states it is not a sandbox.
- Verdict: copy an idea. Its wrapper-aware parsing (catching `bash -c` and `python -c`) fits run-guard, which only holds when python runs the check. Adopt as is if we want destructive-command coverage, since that is a separate job from the test hold.

### claude-code-hooks-mastery

- Link: https://github.com/disler/claude-code-hooks-mastery (about 4.0k stars, last update not shown)
- Reference repo with standalone Python hook scripts for the lifecycle events, each logging its JSON payload, plus status line and output style examples.
- Verdict: copy an idea. Its log-every-payload approach works as a debugging mode so we can see what hooks actually receive, which settles the question of undocumented usage fields.

### Docs hook for trimming test output

- Link: https://code.claude.com/docs/en/costs
- Shows a PreToolUse hook that rewrites test commands to keep the last 100 lines via `updatedInput`.
- Verdict: copy an idea. run-guard can rewrite as well as hold, which saves context on noisy test runs.

## Marketplaces and lists

### claude-plugins-official

- Link: https://github.com/anthropics/claude-plugins-official (47.7k stars, 4,863 commits on main, last update not shown)
- Anthropic's directory. Its own plugins sit in `/plugins`, legacy third-party and channel plugins (Discord, fakechat, iMessage, Telegram) in `/external_plugins`. Install with `/plugin install {plugin-name}@claude-plugins-official`. Third-party submissions now go through claude.ai/directory/manage. The page did not list individual plugins, and I found no official usage or status line plugin from it (unverified beyond that page).
- Verdict: copy an idea. Follow its manifest rule that a plugin `name` is immutable and a separate `displayName` carries the label, for our mods pane.

### anthropics/claude-code plugins folder

- Link: https://github.com/anthropics/claude-code/tree/main/plugins
- Now only a README pointing to claude-plugins-official.
- Verdict: skip.

### awesome-claude-code

- Link: https://github.com/hesreallyhim/awesome-claude-code (58.3k stars, last update not shown)
- Curated list covering skills, agents, status lines, tooling and plugins. I could not read its category list from the page I fetched.
- Verdict: skip for now. Use it as a place to search when a specific need comes up, and verify any entry before use.

## Ideas to take into our mods

Usage view (fleet-gauge)

- Read `rate_limits.five_hour` and `rate_limits.seven_day` for used percentage and `resets_at`, and show the reset as a countdown. Refresh with `refreshInterval`; Claude Code also reruns the script when a window reaches its reset time.
- Label every number by source: official (`rate_limits`, `context_window`), local estimate (cost at list price, transcript counts), or not available. This comes from Claude Code Usage Monitor.
- Credits are not in the JSON. Show them as "see /usage-credits" with no number, or say not available, rather than guessing.
- Show context as a percentage of the real window and as tokens, and when an auto-compact window is set, show a "usable" percentage against that window, as ccstatusline does. For the 541k reading on a 1M window, `used_percentage` says about 54%, while a 500k compact window would already be past full.
- Add the `prompt_cache` warm or cold flag, because a cold cache after a break is a hidden cost at large contexts.
- Handle absent `rate_limits` before the first response and after a window expires.

Compact suggestion and auto-compact

- Suggest compaction at a settable percentage of the effective window, advisory by default with an enforce switch (everything-claude-code context-gate idea).
- For the auto option, a mod calls `$.session.compact` after a turn ends, which a shell hook cannot. The engine's own window (`autoCompactWindow` or the per-model `/autocompact` value) stays the backstop. On 18 November 2026 the live `~/.claude/settings.json` held `autoCompactWindow: 1000000` while this repository's `settings.json` held 200000, which is why a 541k context never compacted.
- Add a PreCompact hook that returns summary instructions, and a SessionStart(compact) hook that restores the routing table and current task.
- Offer a per-hook disable list.

Mods pane

- Model the `/hud` style setup command, and keep stable plugin names with separate display names.
- Include a payload-log mode from hooks-mastery to show what each hook received.

Model and effort routing

- Set `CLAUDE_CODE_SUBAGENT_MODEL` or per-subagent `model` and `effort` frontmatter, use `opusplan` for planning-heavy sessions, and log `PostModelSwitch` events.
- Keep the nudge for Agent calls without a model, and have it check effort too.
- Tie routing to pressure: when `seven_day.used_percentage` is high, the nudge prefers smaller models and lower effort for subagents.
- Do not use a proxy router.

Run guard

- Parse wrapper forms (`bash -c`, `python -c`) as claude-code-safety-net does, and consider rewriting noisy test commands to keep only the tail of output.
