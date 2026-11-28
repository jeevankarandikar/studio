# run-guard

A Claude Code mod that holds a Bash command once when it is about to go wrong in a way the model cannot see from the command alone. The model is told why and either fixes the command or sends it again unchanged, which runs it as written.

It holds a command in these cases:

- It runs `claude -p` (or `--print`) where a command starts and the `ANTHROPIC_API_KEY` the desktop app passes down is still set, so the child fails with Invalid API key. Dropping the key with `env -u ANTHROPIC_API_KEY`, `unset ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY=` lets it pass. A `claude -p` named inside a commit message, a heredoc or a grep is not a run. This rule needs no setting.
- It runs a check against the real data home: the command matches `RUN_GUARD_CHECK` and sets no `RUN_GUARD_HOME_VAR`, or sets it to a path in `RUN_GUARD_DATA_HOME`.
- It matches `RUN_GUARD_LONG`, a run that takes hours, and is not sent with `run_in_background`.

With no `RUN_GUARD_` setting, only the `claude -p` rule applies.

## Settings

Each one is an environment variable, set in the `env` block of Claude Code's `settings.json`. A pattern is a JavaScript regular expression matched against the whole command, so a backslash is written twice in JSON. A pattern that does not compile turns its rule off, and the mod says so in a toast once a session.

| Setting | Meaning | Example |
|---|---|---|
| `RUN_GUARD_CHECK` | The commands that count as checks. The data home rule is off without it. | `"\\bpytest\\b\|\\bnpm test\\b"` |
| `RUN_GUARD_HOME_VAR` | The variable that points a check at a home of its own. A check that sets it passes. The data home rule is off without it. | `"APP_HOME"` |
| `RUN_GUARD_DATA_HOME` | The real data home, or several joined with `:`. A check that sets `RUN_GUARD_HOME_VAR` to one of them is held too. `~`, `$HOME` and the full path count as the same folder. Optional. | `"~/.app"` |
| `RUN_GUARD_EXEMPT` | Commands that make their own home and pass even when they match `RUN_GUARD_CHECK`. Optional. | `"\\brelease\\.sh\\b"` |
| `RUN_GUARD_HOME_HINT` | What the model is told to do instead. Without it the mod says to run the check as `<VAR>="$H" <command>`. Optional. | `"Make a home with mktemp -d and run it as APP_HOME=\"$H\" <command>"` |
| `RUN_GUARD_LONG` | The commands that run for hours. The foreground rule is off without it. | `"\\bmake soak\\b"` |
| `RUN_GUARD_LONG_HINT` | A faster form of the run, offered after `run_in_background`. Optional. | `"use make soak-quick"` |
| `RUN_GUARD_REPO` | Path fragments joined with `:`. The data home and long run rules apply only when the session's working directory, a subagent's own included, contains one of them, so a script of the same name in another repository runs at once. Unset means every repository. Optional. | `"/my-app"` |

## Example

Samskara's checks are Python scripts that read its archive at `~/.samskara` unless `SAMSKARA_HOME` points them elsewhere, and its full healthcheck runs for hours unless given `--fast`. Its code lives in a checkout named `samskara`. These settings hold those runs there and nowhere else, and the tests in `hooks/register.test.ts` run with the same values:

```json
{
  "env": {
    "RUN_GUARD_CHECK": "\\bpython3?(?:\\s+-\\S+)*\\s+(?:\\S*healthcheck\\.py\\b|\\S*golden\\.py\\s+run\\b|\\S*scripts\\/check\\.py\\b|\\S*test_fresh_home\\.py\\b|\\S+\\.py\\s+selftest\\b|-m\\s+[\\w.]+\\s+selftest\\b)",
    "RUN_GUARD_HOME_VAR": "SAMSKARA_HOME",
    "RUN_GUARD_DATA_HOME": "~/.samskara",
    "RUN_GUARD_EXEMPT": "\\b(?:ship\\.py|release\\.sh)\\b",
    "RUN_GUARD_HOME_HINT": "Give it a throwaway home with data/exports and vault folders and a .env holding SAMSKARA_NO_LOCAL_EXTRACT=1, and run it as env -u SAMSKARA_DB -u SAMSKARA_DATA -u SAMSKARA_VAULT SAMSKARA_HOME=\"$H\" SAMSKARA_NO_LOCAL_EXTRACT=1 <command>",
    "RUN_GUARD_LONG": "\\bpython3?(?:\\s+-\\S+)*\\s+\\S*healthcheck\\.py\\b(?![^|;&]*--fast)",
    "RUN_GUARD_LONG_HINT": "add --fast",
    "RUN_GUARD_REPO": "/samskara"
  }
}
```

Run `claude plugin test .` in this folder after an edit.
