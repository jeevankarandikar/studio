#!/usr/bin/env python3
"""PreToolUse guard for Write, Edit and NotebookEdit: where files may be written.

With bash_guard.py, which asks this file for its verdict on shell writes, this is the
whole filesystem policy. The folders come from settings, so the guard holds no one's
layout:

  STUDIO_GUARD_BLOCKED   folders nothing is written into, colon-separated
                         ("~/Desktop:~/Downloads:~/Documents")
  STUDIO_GUARD_PROJECTS  folders new work lives in ("~/Developer/GitHub"). Each one's
                         parent takes no file of its own and no folder beside it.

Set them under `env` in ~/.claude/settings.json. With neither set, every path passes.
The writing rules are a separate hook, writing-guard/writing_guard.py.

Exit 2 blocks the call and returns stderr to the agent; exit 0 allows.
Run `file_guard.py --selftest` to check.
"""
import json
import os
import re
import sys


def _folders(name: str) -> list[str]:
    raw = os.environ.get(name, "")
    return [os.path.abspath(os.path.expanduser(p)).rstrip("/") for p in raw.split(":") if p.strip()]


def rules() -> list[re.Pattern]:
    found = []
    for folder in _folders("STUDIO_GUARD_BLOCKED"):
        found.append(re.compile(rf"^{re.escape(folder)}(/|$)"))
    for folder in _folders("STUDIO_GUARD_PROJECTS"):
        parent, name = os.path.split(folder)
        found.append(re.compile(rf"^{re.escape(parent)}/[^/]+$"))
        found.append(re.compile(rf"^{re.escape(parent)}/(?!{re.escape(name)}/)[^/]+/"))
    return found


def message() -> str:
    projects = os.environ.get("STUDIO_GUARD_PROJECTS", "").replace(":", " or ")
    blocked = os.environ.get("STUDIO_GUARD_BLOCKED", "").replace(":", ", ")
    where = f"Files go in {projects} or a scratch folder" if projects else "Files go elsewhere"
    tail = f", never {blocked}" if blocked else ""
    return f"BLOCKED: {where}{tail}. The folders are set in STUDIO_GUARD_BLOCKED and STUDIO_GUARD_PROJECTS."


def verdict(path: str, cwd: str = ""):
    """return (exit_code, message). 2 = block, 0 = allow."""
    if not isinstance(path, str) or not path:
        return 0, ""
    resolved = os.path.abspath(os.path.join(cwd or os.getcwd(), os.path.expanduser(path)))
    if any(p.match(resolved) for p in rules()):
        return 2, message()
    return 0, ""


def _selftest() -> None:
    home = os.path.expanduser("~")
    saved = {k: os.environ.get(k) for k in ("STUDIO_GUARD_BLOCKED", "STUDIO_GUARD_PROJECTS")}
    try:
        os.environ.pop("STUDIO_GUARD_BLOCKED", None)
        os.environ.pop("STUDIO_GUARD_PROJECTS", None)
        assert verdict(f"{home}/Desktop/a.png")[0] == 0  # nothing set, nothing blocked
        os.environ["STUDIO_GUARD_BLOCKED"] = "~/Desktop:~/Downloads:~/Documents"
        os.environ["STUDIO_GUARD_PROJECTS"] = "~/Developer/GitHub"
        assert verdict(f"{home}/Developer/screenshot.png")[0] == 2
        assert verdict(f"{home}/Developer/design-screens/a.png")[0] == 2
        assert verdict(f"{home}/Documents/GitHub/x/file.py")[0] == 2
        assert verdict(f"{home}/Developer/GitHub/app/page.tsx")[0] == 0
        assert verdict(f"{home}/Developer/GitHub")[0] == 2  # a file named like the folder
        assert verdict("/tmp/scratch/x.md")[0] == 0
        assert verdict("")[0] == 0
        assert verdict(f"{home}/Documents/notes.md")[0] == 2
        assert verdict(f"{home}/Desktop/mock.png")[0] == 2
        assert verdict(f"{home}/Downloads/x.md")[0] == 2
        assert verdict(f"{home}/Desktopper/x.md")[0] == 0
        assert verdict("~/Developer/loose.txt")[0] == 2
        assert verdict("loose.txt", f"{home}/Developer")[0] == 2
        assert verdict("src/app.ts", f"{home}/Developer/GitHub/app")[0] == 0
        assert "~/Developer/GitHub" in verdict("~/Desktop/a")[1]
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    print("selftest ok")


def main() -> None:
    if "--selftest" in sys.argv:
        _selftest()
        return
    try:
        event = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # a malformed event passes, so a broken hook never stops work
    if not isinstance(event, dict):
        sys.exit(0)
    # Cursor also runs the hooks it imports from Claude Code's settings. That copy
    # defers to the one installed for Cursor, which passes --cursor-native.
    if "cursor_version" in event and "--cursor-native" not in sys.argv:
        return
    tool_input = event.get("tool_input") or {}
    path = tool_input.get("file_path") or tool_input.get("notebook_path", "")
    cwd = event.get("cwd") or tool_input.get("cwd") or os.getcwd()
    code, text = verdict(path, cwd)
    if code == 2:
        print(text, file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
