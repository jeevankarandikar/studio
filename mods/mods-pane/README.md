# mods-pane

A Claude Code mod with a pane that lists each mod: its name and version, whether it is on, what it does, and the last error seen this session. `/mod-list` opens it. Docked it shows every row; as a desktop widget it shows how many are on and how many have an error.

## Where each column comes from

- The list joins three sources: the folders in `CLAUDE_CODE_PLUGIN_DIRS`, `enabledPlugins` in settings, and every hooks module the engine loads after this one.
- "on" means the pane saw the mod join this session. "off" means settings set it to false or a judge refused it at load. "listed, load not seen" means it is named in a folder list or settings but loaded before the pane, so the pane cannot confirm it. Load `mods-pane` first in `CLAUDE_CODE_PLUGIN_DIRS` to see the others join.
- The description is the mod's own `plugin.json` description.
- The last error is a refusal at load, or a transcript notice in the engine's form `<mod>: ... hook skipped ...`. A failure the engine writes only to the debug log does not reach the pane.

Run `claude plugin test .` in this folder after an edit.
