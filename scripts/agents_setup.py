"""Agent config for install.py: settings, guards, instructions, retiring an old kit, and history.

Everything here writes into the agents' own folders (~/.claude, ~/.codex, ~/.cursor,
~/.agents) and nothing into this clone. Every change goes through a history session:
the state of each file and link folder it may touch is read before, and whatever
changed is kept under ~/.local/state/studio/history/<id>, so `install.py --diff <id>`
shows it and `install.py --rollback <id>` puts it back.

Settings merge by adding: a key the person already set keeps its value, a list keeps
its items and gains the missing ones. The one replacement is a plugin folder or hook
script of the same name that now comes from this clone, since loading two copies of
one mod or guard is never wanted.
"""
from __future__ import annotations

import base64
import difflib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
HOME = Path.home()
CLAUDE = Path(os.environ.get("CLAUDE_CONFIG_DIR") or HOME / ".claude")
CODEX = Path(os.environ.get("CODEX_HOME") or HOME / ".codex")
CURSOR = HOME / ".cursor"
STATE = Path(os.environ.get("STUDIO_STATE") or HOME / ".local" / "state" / "studio")
# Settings a skill reads in any agent. Only Claude Code hands its settings env to the
# shell, so values Codex and Cursor need too are also written here, one file each.
CONFIG = Path(os.environ.get("STUDIO_CONFIG") or HOME / ".config" / "studio")
SHARED_ENV = {"VOICE_CONTEXT": "voice-context"}
HISTORY = STATE / "history"

WATCHED_FILES = [
    CLAUDE / "settings.json", CLAUDE / "CLAUDE.md",
    CODEX / "hooks.json", CODEX / "AGENTS.md", CODEX / "config.toml",
    CURSOR / "hooks.json", CURSOR / "rules" / "studio-instructions.mdc",
    *(CONFIG / name for name in SHARED_ENV.values()),
]
WATCHED_FOLDERS = [
    CLAUDE / "skills", CLAUDE / "agents", HOME / ".agents" / "skills",
    CURSOR / "skills", CURSOR / "rules", CURSOR / "plugins" / "local",
]


# ---- history ---------------------------------------------------------------

def _file_state(path: Path):
    if path.is_symlink():
        return {"link": os.readlink(path)}
    if path.is_file():
        return {"bytes": base64.b64encode(path.read_bytes()).decode()}
    return None


def _folder_state(path: Path):
    if path.is_symlink():
        return {"link": os.readlink(path)}
    if not path.is_dir():
        return None
    entries = {}
    for child in sorted(path.iterdir()):
        if child.is_symlink():
            entries[child.name] = {"link": os.readlink(child)}
        else:
            entries[child.name] = {"dir" if child.is_dir() else "file": True}
    return {"entries": entries}


def _snapshot() -> dict:
    return {
        "files": {str(p): _file_state(p) for p in WATCHED_FILES},
        "folders": {str(p): _folder_state(p) for p in WATCHED_FOLDERS},
    }


class Session:
    """Read the agents' state on entry; on exit keep what changed, with its old contents."""

    def __init__(self, command: str):
        self.command = command
        self.moves: list[tuple[str, str]] = []

    def __enter__(self):
        self.before = _snapshot()
        return self

    def moved(self, source: Path, target: Path) -> None:
        self.moves.append((str(source), str(target)))

    def __exit__(self, *exc):
        after = _snapshot()
        changed = {
            kind: {p: s for p, s in self.before[kind].items() if after[kind][p] != s}
            for kind in ("files", "folders")
        }
        if not (changed["files"] or changed["folders"] or self.moves):
            return False
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
        folder = HISTORY / stamp
        n = 1
        while folder.exists():
            n += 1
            folder = HISTORY / f"{stamp}-{n}"
        folder.mkdir(parents=True)
        manifest = {"id": folder.name, "utc": stamp, "command": self.command,
                    "before": changed, "after": {k: {p: after[k][p] for p in v} for k, v in changed.items()},
                    "moves": self.moves}
        (folder / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
        print(f"history: kept what this run replaced as {folder.name} (install.py --diff {folder.name})")
        return False


def _load(entry_id: str) -> dict:
    path = HISTORY / entry_id / "manifest.json"
    if not path.is_file():
        raise SystemExit(f"no history entry {entry_id}; install.py --history lists them")
    return json.loads(path.read_text())


def history() -> None:
    if not HISTORY.is_dir() or not any(HISTORY.iterdir()):
        print(f"no history yet in {HISTORY}")
        return
    for folder in sorted(HISTORY.iterdir()):
        m = json.loads((folder / "manifest.json").read_text())
        paths = [*m["before"]["files"], *m["before"]["folders"]]
        print(f"{m['id']}  {m['command']}")
        for p in paths:
            print(f"    {p.replace(str(HOME), '~')}")


def _text(state) -> list[str]:
    if state is None:
        return []
    if "link" in state:
        return [f"link to {state['link']}\n"]
    if "bytes" in state:
        return base64.b64decode(state["bytes"]).decode("utf-8", "replace").splitlines(keepends=True)
    return [f"{name}: {json.dumps(v)}\n" for name, v in state.get("entries", {}).items()]


def diff(entry_id: str) -> None:
    m = _load(entry_id)
    now = _snapshot()
    for kind in ("files", "folders"):
        for path, before in m["before"][kind].items():
            lines = difflib.unified_diff(_text(before), _text(now[kind][path]),
                                         f"{path} before {m['id']}", f"{path} now")
            sys.stdout.writelines(lines)
    for source, target in m["moves"]:
        print(f"moved {source} -> {target}")


def _restore_file(path: Path, state) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    if state is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if "link" in state:
        path.symlink_to(state["link"])
    else:
        path.write_bytes(base64.b64decode(state["bytes"]))


def _restore_folder(path: Path, state) -> None:
    if state is not None and "link" in state:
        if path.is_dir() and not path.is_symlink():
            leftovers = [c for c in path.iterdir() if not c.is_symlink()]
            if leftovers:
                raise SystemExit(f"{path} holds {len(leftovers)} real items; move them out before rolling back")
            for c in path.iterdir():
                c.unlink()
            path.rmdir()
        elif path.is_symlink():
            path.unlink()
        path.symlink_to(state["link"], target_is_directory=True)
        return
    wanted = (state or {}).get("entries", {})
    if path.is_dir():
        for child in path.iterdir():
            if child.is_symlink() and wanted.get(child.name) != {"link": os.readlink(child)}:
                child.unlink()
    for name, entry in wanted.items():
        if "link" in entry and not (path / name).is_symlink():
            path.mkdir(parents=True, exist_ok=True)
            (path / name).symlink_to(entry["link"])


def rollback(entry_id: str) -> None:
    m = _load(entry_id)
    with Session(f"rollback {entry_id}"):
        for source, target in reversed(m["moves"]):
            if Path(target).exists() and not Path(source).exists():
                Path(source).parent.mkdir(parents=True, exist_ok=True)
                shutil.move(target, source)
        for path, state in m["before"]["folders"].items():
            _restore_folder(Path(path), state)
        for path, state in m["before"]["files"].items():
            _restore_file(Path(path), state)
    print(f"rolled back {entry_id}")


# ---- json files ------------------------------------------------------------

def read_json(path: Path) -> dict:
    if path.is_symlink():
        raise SystemExit(f"{path} is a link; the agent rewrites it in place, so it must be a file")
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except ValueError as error:
        raise SystemExit(f"{path} is not valid JSON, left alone: {error}")
    if not isinstance(data, dict):
        raise SystemExit(f"{path} has an unexpected shape, left alone")
    return data


def write_json(path: Path, data: dict) -> str:
    text = json.dumps(data, indent=2) + "\n"
    if path.exists() and path.read_text() == text:
        return f"no change: {path}"
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp")
    temp.write_text(text)
    temp.replace(path)
    return f"wrote {path}"


def _commands(entry) -> list[str]:
    if not isinstance(entry, dict):
        return []
    found = [entry.get("command")]
    if isinstance(entry.get("hooks"), list):
        found += [h.get("command") for h in entry["hooks"] if isinstance(h, dict)]
    return [c for c in found if isinstance(c, str)]


SCRIPT = re.compile(r"[\w.-]+\.py\b")


def _scripts(entry) -> set[str]:
    return {m for c in _commands(entry) for m in SCRIPT.findall(c)}


def merge(base, layer, path=()):
    """Add layer to base. Existing values stay; lists gain the items they lack."""
    if isinstance(base, dict) and isinstance(layer, dict):
        for key, value in layer.items():
            if key not in base:
                base[key] = value
            elif key == "CLAUDE_CODE_PLUGIN_DIRS" and isinstance(value, str):
                base[key] = merge_plugin_dirs(base[key], value)
            else:
                base[key] = merge(base[key], value, path + (key,))
        return base
    if isinstance(base, list) and isinstance(layer, list):
        in_hooks = len(path) >= 2 and path[0] == "hooks"
        for item in layer:
            if item in base:
                continue
            if in_hooks and _scripts(item):
                # a guard of the same name from this clone replaces the old copy
                base[:] = [e for e in base if not (_scripts(e) & _scripts(item) and _from_studio(item))]
            base.append(item)
        return base
    return base


def _from_studio(entry) -> bool:
    return any(str(HERE) in c for c in _commands(entry))


def _expand(path: str) -> str:
    return os.path.abspath(os.path.expanduser(path.replace("$HOME", str(HOME))))


def merge_plugin_dirs(current: str, wanted: str) -> str:
    ours = [p for p in wanted.split(":") if p]
    names = {Path(_expand(p)).name for p in ours}
    kept = [p for p in current.split(":") if p and Path(_expand(p)).name not in names]
    ordered = ours + kept
    ordered.sort(key=lambda p: Path(_expand(p)).name != "mods-pane")
    return ":".join(ordered)


# ---- what this clone offers ------------------------------------------------

def mod_dirs() -> list[Path]:
    found = [f.parent.parent for f in (HERE / "mods").glob("*/.claude-plugin/plugin.json")]
    return sorted(found, key=lambda d: (d.name != "mods-pane", d.name))


def claude_fragment() -> dict:
    template = (HERE / "settings" / "claude.json").read_text().replace("{studio}", str(HERE))
    data = json.loads(template)
    data.pop("note", None)
    data.setdefault("env", {})["CLAUDE_CODE_PLUGIN_DIRS"] = ":".join(str(d) for d in mod_dirs())
    return data


def guard_command(name: str, flag: str = "") -> str:
    return f'python3 "{HERE / "guards" / name}"{flag}'


def settings(layers: list[Path]) -> None:
    path = CLAUDE / "settings.json"
    data = read_json(path)
    merge(data, claude_fragment())
    for layer in layers:
        merge(data, read_json(layer))
    print(write_json(path, data))
    env = data.get("env") if isinstance(data.get("env"), dict) else {}
    for key, name in SHARED_ENV.items():
        if isinstance(env.get(key), str) and env[key]:
            target = CONFIG / name
            text = env[key] + "\n"
            if target.is_file() and target.read_text() == text:
                print(f"no change: {target}")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
            print(f"wrote {target}, so every agent's skills can read {key}")


def guards(chosen: list[str]) -> None:
    if "claude" in chosen:
        path = CLAUDE / "settings.json"
        data = read_json(path)
        merge(data, {"hooks": {"PreToolUse": [
            {"matcher": "Bash", "hooks": [{"type": "command", "command": guard_command("bash_guard.py"), "timeout": 10}]},
            {"matcher": "Write|Edit|NotebookEdit", "hooks": [{"type": "command", "command": guard_command("file_guard.py"), "timeout": 10}]},
        ]}})
        print(write_json(path, data))
    if "codex" in chosen and CODEX.is_dir():
        path = CODEX / "hooks.json"
        data = read_json(path)
        merge(data, {"hooks": {"PreToolUse": [{"matcher": "^Bash$", "hooks": [{
            "type": "command", "command": guard_command("bash_guard.py"), "timeout": 30,
            "statusMessage": "Checking command safety"}]}]}})
        print(write_json(path, data))
    if "cursor" in chosen and CURSOR.is_dir():
        path = CURSOR / "hooks.json"
        data = read_json(path)
        data.setdefault("version", 1)
        merge(data, {"hooks": {
            "beforeShellExecution": [{"command": guard_command("bash_guard.py", " --cursor-native"), "timeout": 10}],
            "preToolUse": [{"command": guard_command("file_guard.py", " --cursor-native"), "matcher": "Write", "timeout": 10}],
        }})
        print(write_json(path, data))


def instructions(chosen: list[str]) -> None:
    """Give Codex and Cursor the same global instructions as ~/.claude/CLAUDE.md."""
    source = CLAUDE / "CLAUDE.md"
    if not source.is_file():
        print(f"no {source}, so Codex and Cursor get no instructions from it")
        return
    text = source.read_text().rstrip() + "\n"
    note = f"<!-- Written by studio's install.py --instructions from {source}. Edit that file, then run it again. -->\n\n"
    targets = []
    if "codex" in chosen and CODEX.is_dir():
        targets.append((CODEX / "AGENTS.md", note + text))
    if "cursor" in chosen and CURSOR.is_dir():
        front = "---\ndescription: Global instructions, the same ones Claude Code reads.\nalwaysApply: true\n---\n\n"
        targets.append((CURSOR / "rules" / "studio-instructions.mdc", front + note + text))
    for path, body in targets:
        if path.is_symlink():
            path.unlink()
        if path.is_file() and path.read_text() == body:
            print(f"no change: {path}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)
        print(f"wrote {path}")


# ---- retiring an old kit ---------------------------------------------------

def _under(target: str, old: Path, base: Path | None = None) -> bool:
    raw = target.replace("$HOME", str(HOME))
    full = Path(os.path.expanduser(raw))
    if not full.is_absolute() and base is not None:
        full = base / full
    full = Path(os.path.abspath(full))
    return full == old or old in full.parents


def _mentions(command: str, old: Path) -> bool:
    forms = {str(old), str(old).replace(str(HOME), "$HOME"), str(old).replace(str(HOME), "~")}
    return any(f in command for f in forms)


def _drop_hooks(data: dict, old: Path) -> int:
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return 0
    dropped = 0
    for event in list(hooks):
        entries = hooks[event]
        if not isinstance(entries, list):
            continue
        kept = []
        for entry in entries:
            if isinstance(entry, dict) and isinstance(entry.get("hooks"), list):
                inner = [h for h in entry["hooks"] if not (isinstance(h, dict) and _mentions(str(h.get("command", "")), old))]
                dropped += len(entry["hooks"]) - len(inner)
                if inner:
                    kept.append({**entry, "hooks": inner})
            elif isinstance(entry, dict) and _mentions(str(entry.get("command", "")), old):
                dropped += 1
            else:
                kept.append(entry)
        if kept:
            hooks[event] = kept
        else:
            hooks.pop(event)
    return dropped


def _strip_dirs(value: str, old: Path) -> str:
    """Drop plugin folders inside the old kit; one this clone also has moves to this clone's copy."""
    ours = {d.name: str(d) for d in mod_dirs()}
    kept = []
    for p in (p for p in value.split(":") if p):
        if _under(p, old):
            p = ours.get(Path(_expand(p)).name, "")
        if p and p not in kept:
            kept.append(p)
    return ":".join(kept)


def retire(old: Path, session: Session, provided: set[str]) -> None:
    """Take out every hook, plugin folder and link that points into an old kit."""
    old = Path(os.path.abspath(old.expanduser()))
    print(f"retiring {old}")
    for path in (CLAUDE / "settings.json", CODEX / "hooks.json", CURSOR / "hooks.json"):
        if not path.exists():
            continue
        data = read_json(path)
        dropped = _drop_hooks(data, old)
        env = data.get("env") if isinstance(data.get("env"), dict) else {}
        if isinstance(env.get("CLAUDE_CODE_PLUGIN_DIRS"), str):
            env["CLAUDE_CODE_PLUGIN_DIRS"] = _strip_dirs(env["CLAUDE_CODE_PLUGIN_DIRS"], old)
        if dropped or env:
            print(f"  {write_json(path, data)} ({dropped} hooks taken out)")
    toml = CODEX / "config.toml"
    if toml.is_file():
        text = toml.read_text()
        line = re.compile(r'^(CLAUDE_CODE_PLUGIN_DIRS[ \t]*=[ \t]*")([^"\n]*)(")[ \t]*$', re.M)
        new = line.sub(lambda m: m.group(1) + _strip_dirs(m.group(2), old) + m.group(3), text)
        new = re.sub(r'^CLAUDE_CODE_PLUGIN_DIRS[ \t]*=[ \t]*""[ \t]*\n', "", new, flags=re.M)
        if new != text:
            toml.write_text(new)
            print(f"  wrote {toml}")
        for n, row in enumerate(new.splitlines(), 1):
            if _mentions(row, old) and not row.lstrip().startswith("["):
                print(f"  {toml}:{n} still names it; edit that line by hand")
    for folder in WATCHED_FOLDERS:
        if folder.is_symlink() and _under(os.readlink(folder), old, folder.parent):
            _unfold(folder, old, session, provided)
        elif folder.is_dir():
            for child in sorted(folder.iterdir()):
                if child.is_symlink() and _under(os.readlink(child), old, folder):
                    child.unlink()
                    print(f"  unlinked {child}")
    md = CLAUDE / "CLAUDE.md"
    if md.is_symlink() and _under(os.readlink(md), old, md.parent):
        text = md.read_text()
        md.unlink()
        md.write_text(text)
        print(f"  {md} is now a file with the same text")


def _unfold(folder: Path, old: Path, session: Session, provided: set[str]) -> None:
    """A folder that is a link into the old kit becomes a real folder beside it."""
    source = (folder.parent / os.readlink(folder)).resolve()
    folder.unlink()
    folder.mkdir()
    print(f"  {folder} is now a real folder")
    for child in sorted(source.iterdir()):
        if child.is_symlink():
            target = (child.parent / os.readlink(child)).resolve()
            if not _under(str(target), old):
                (folder / child.name).symlink_to(target)
                print(f"  linked {folder / child.name} -> {target}")
        elif child.name not in provided and not child.name.startswith("."):
            shutil.move(str(child), str(folder / child.name))
            session.moved(child, folder / child.name)
            print(f"  moved {child} -> {folder / child.name}")
