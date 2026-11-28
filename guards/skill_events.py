#!/usr/bin/env python3
"""Claude Code hook: one line per skill use, with no prompt text and no file contents.

PostToolUse on the Skill tool records a skill the model chose. UserPromptSubmit records
a skill the person typed as /name, and only the name. Each line holds the time, the
session id, the skill, who picked it, and the skill folder's last commit when it lives
in a git clone. Lines go to $STUDIO_STATE/events.jsonl (default
~/.local/state/studio/events.jsonl); scripts/skill_report.py reads them with the
session transcripts to give tokens per skill.

A hook that fails records nothing and never blocks. Run `skill_events.py --selftest`.
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

STATE = Path(os.environ.get("STUDIO_STATE") or Path.home() / ".local" / "state" / "studio")
SKILLS = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude") / "skills"
TYPED = re.compile(r"^/([a-z0-9][\w:-]*)(?:\s|$)")


def version(skill: str) -> str:
    folder = SKILLS / skill.split(":")[-1]
    if not folder.exists():
        return ""
    real = folder.resolve()
    done = subprocess.run(["git", "-C", str(real), "log", "-1", "--format=%h", "--", "."],
                          capture_output=True, text=True, timeout=3)
    return done.stdout.strip() if done.returncode == 0 else ""


def event_line(event: dict):
    name = str(event.get("hook_event_name") or "")
    if name == "PostToolUse" and event.get("tool_name") == "Skill":
        tool_input = event.get("tool_input") or {}
        skill, by = str(tool_input.get("skill") or tool_input.get("command") or ""), "model"
    elif name == "UserPromptSubmit":
        m = TYPED.match(str(event.get("prompt") or ""))
        skill, by = (m.group(1), "user") if m else ("", "")
    else:
        return None
    if not skill:
        return None
    return {"utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "session": str(event.get("session_id") or ""), "skill": skill, "by": by,
            "version": version(skill)}


def _selftest() -> None:
    chose = event_line({"hook_event_name": "PostToolUse", "tool_name": "Skill",
                        "tool_input": {"skill": "voice", "args": "a private draft"}, "session_id": "s1"})
    assert chose["skill"] == "voice" and chose["by"] == "model" and "draft" not in json.dumps(chose)
    typed = event_line({"hook_event_name": "UserPromptSubmit", "prompt": "/voice apply Acme with my secret", "session_id": "s1"})
    assert typed["skill"] == "voice" and typed["by"] == "user" and "Acme" not in json.dumps(typed)
    assert event_line({"hook_event_name": "UserPromptSubmit", "prompt": "what is /usr/bin"}) is None
    assert event_line({"hook_event_name": "PostToolUse", "tool_name": "Bash", "tool_input": {}}) is None
    print("selftest ok")


def main() -> None:
    if "--selftest" in sys.argv:
        _selftest()
        return
    try:
        line = event_line(json.load(sys.stdin))
        if line:
            STATE.mkdir(parents=True, exist_ok=True)
            with open(STATE / "events.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps(line) + "\n")
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
