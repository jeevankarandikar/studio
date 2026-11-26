# fleet-gauge

`fleet-gauge` is a Claude Code mod that shows usage when it needs a decision and helps you compact before a long context eats the week. It needs Claude Code 2.1.287 or later. Cursor and Codex get a smaller version, described at the end.

A row appears above the prompt only when one of these is true:

- the weekly limit is at 50% or more, shown with the time left until it resets
- the five-hour limit is at 70% or more, with its reset
- the session's context is at 200k tokens or more, or past the compact threshold
- a subagent is running, with the call count of the longest one

Past the compact threshold the context turns yellow, reads "compact when this step ends", and one toast says so. A toast also fires when a subagent reaches 150 tool calls, and again at 300. An agent rereads its whole context on every call, so long agents and long sessions cost the most.

`/gauge` opens a Usage pane. `/fleet` prints every reading and lists the session's subagents by tool calls made.

## What it can read

Every figure comes from the engine's own measurement. Where the engine gives none, the pane says so instead of showing a number.

- Context: tokens of the last request and the model's window.
- Week and five hours: percent used and reset time, when the engine's last response carried them. On 18 November 2026 a subscription session carried the week and no five-hour figure.
- Extra usage: the spend limit's percent when the engine reports a `spend_limit` window. There is no credit balance for a mod to read.
- Session cost: dollars at API prices, a measure on a subscription rather than a bill.
- Engine auto-compact: whether it is on and the token count it fires at, read when you open `/gauge`.

## Settings

Set these in `/config` under fleet-gauge, or in `pluginConfigs` in settings.json:

- `compact_at`, default 40: the percent of the window at which it suggests compacting.
- `auto_compact`, default off: when on, the mod compacts the conversation after a turn ends at `auto_compact_at` or more, telling the summary to keep the task, the files changed, decisions, checks and what is left.
- `auto_compact_at`, default 60.

The engine's own auto-compact is separate: `autoCompactWindow` in settings.json sets where it fires.

## Load it

For one session, from the studio clone:

```bash
claude --plugin-dir mods/fleet-gauge
```

For every session, `python3 install.py --mods` prints the `CLAUDE_CODE_PLUGIN_DIRS` value for this clone. Start a new session after changing it, and run `claude plugin test .` in this folder after an edit.

## Cursor and Codex

Neither agent lets a mod draw in its interface, so they get the parts that can be rebuilt.

```bash
python3 mods/fleet-gauge/other-agents/install.py
```

- Both get a hook that counts tool calls in a session. At 150 calls, and every 50 after, it tells the agent to finish the step in hand, write a handoff note and say a new session should take over. Set `FLEET_GAUGE_CALLS` to change the limit.
- Codex also gets a status line showing context used and the five-hour and weekly limits. Codex draws that itself; the installer only turns it on, and leaves a status line you already set alone.
- Cursor does not tell hooks about your usage and has no status row to write to, so there is no limits display there.

Codex skips a new hook until you trust it. Open Codex, type `/hooks`, and press `t`.

`python3 mods/fleet-gauge/other-agents/install.py --remove` takes it out.
