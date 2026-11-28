#!/usr/bin/env python3
"""install.py against a throwaway home shaped like a real one being moved off an old kit.

    python3 scripts/test_install.py

The home has an old kit folder that ~/.claude/skills and ~/.claude/CLAUDE.md link
into, hooks and mod folders in all three agents that point at it, and an app-owned
`synced/` folder inside its skills. One install run retires the kit, adds settings,
guards and instructions; the history entry it leaves must roll every byte back.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


def build(home: Path) -> Path:
    kit = home / "kit"
    (kit / "skills" / "synced" / "bucket").mkdir(parents=True)
    (kit / "skills" / "synced" / "bucket" / "SKILL.md").write_text("app-owned\n")
    (kit / "skills" / "voice").mkdir()
    (kit / "skills" / "voice" / "SKILL.md").write_text("old voice\n")
    (kit / "skills" / "design-jeev").symlink_to(HERE / "skills" / "design-jeev")
    (kit / "config").mkdir()
    (kit / "config" / "CLAUDE.md").write_text("# Global defaults\n\n- Be plain.\n")
    (kit / "hooks").mkdir()
    for name in ("bash_guard.py", "file_guard.py", "reply_guard.py"):
        (kit / "hooks" / name).write_text("")
    (kit / "mods" / "fleet-gauge").mkdir(parents=True)
    (kit / "mods" / "private-mod").mkdir(parents=True)
    # a mod only the kit has is dropped, not kept pointing at a folder that will go

    claude = home / ".claude"
    claude.mkdir()
    (claude / "skills").symlink_to(kit / "skills")
    (claude / "CLAUDE.md").symlink_to(kit / "config" / "CLAUDE.md")
    (claude / "settings.json").write_text(json.dumps({
        "env": {"CLAUDE_CODE_PLUGIN_DIRS": "~/kit/mods/fleet-gauge:~/elsewhere/mods/mine"},
        "model": "opus",
        "permissions": {"allow": ["Bash(ls:*)"]},
        "hooks": {
            "PreToolUse": [
                {"matcher": "Bash", "hooks": [{"type": "command", "command": 'python3 "$HOME/kit/hooks/bash_guard.py"', "timeout": 10}]},
                {"matcher": "Write|Edit|NotebookEdit", "hooks": [{"type": "command", "command": 'python3 "$HOME/kit/hooks/file_guard.py"', "timeout": 10}]},
            ],
            "Stop": [{"hooks": [{"type": "command", "command": 'python3 "$HOME/kit/hooks/reply_guard.py"', "timeout": 10}]}],
        },
    }, indent=2))
    codex = home / ".codex"
    codex.mkdir()
    (codex / "hooks.json").write_text(json.dumps({"hooks": {"PreToolUse": [
        {"matcher": "^Bash$", "hooks": [{"type": "command", "command": 'python3 "$HOME/kit/hooks/bash_guard.py"'}]}]}}))
    (codex / "config.toml").write_text('model = "x"\n\n[shell_environment_policy.set]\nCLAUDE_CODE_PLUGIN_DIRS = "~/kit/mods/fleet-gauge"\n')
    cursor = home / ".cursor"
    (cursor / "rules").mkdir(parents=True)
    (cursor / "skills").mkdir()
    (cursor / "plugins" / "local").mkdir(parents=True)
    (cursor / "skills" / "voice").symlink_to(kit / "skills" / "voice")
    (cursor / "rules" / "kit.mdc").symlink_to(kit / "config" / "CLAUDE.md")
    (cursor / "plugins" / "local" / "kit").symlink_to(kit)
    (cursor / "hooks.json").write_text(json.dumps({"version": 1, "hooks": {"beforeShellExecution": [
        {"command": f'python3 "{kit}/hooks/bash_guard.py" --cursor-native', "timeout": 10}]}}))
    (home / "layer.json").write_text(json.dumps({"env": {"STUDIO_GUARD_BLOCKED": "~/Desktop", "VOICE_CONTEXT": "~/notes/voice.md"}, "model": "sonnet"}))
    return kit


def tree(root: Path) -> dict:
    """Every file's bytes and every link's target under root, skipping the kit and history."""
    found = {}
    for path in sorted(root.rglob("*")):
        rel = str(path.relative_to(root))
        if rel.startswith(("kit", ".local")) or rel == "layer.json":
            continue
        if path.is_symlink():
            found[rel] = "-> " + os.readlink(path)
        elif path.is_file():
            found[rel] = path.read_bytes()
    return found


def run(home: Path, *args: str) -> str:
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDE_CONFIG_DIR", "CODEX_HOME", "STUDIO_STATE", "STUDIO_CONFIG")}
    env["HOME"] = str(home)
    done = subprocess.run([sys.executable, "-B", str(HERE / "install.py"), *args], env=env,
                          capture_output=True, text=True)
    if done.returncode:
        raise SystemExit(f"install.py {' '.join(args)} failed:\n{done.stdout}\n{done.stderr}")
    return done.stdout


def main() -> None:
    home = Path(tempfile.mkdtemp(prefix="studio-install-test-"))
    try:
        kit = build(home)
        before = tree(home)
        out = run(home, "--retire", str(kit), "--settings", "--guards", "--instructions", "--layer", str(home / "layer.json"))

        claude = home / ".claude"
        assert (claude / "skills").is_dir() and not (claude / "skills").is_symlink(), out
        assert (claude / "skills" / "synced" / "bucket" / "SKILL.md").read_text() == "app-owned\n"
        assert not (kit / "skills" / "synced").exists()
        assert (kit / "skills" / "voice" / "SKILL.md").exists()  # studio installs its own voice
        assert os.readlink(claude / "skills" / "voice") == str(HERE / "skills" / "voice")
        assert (claude / "skills" / "design-jeev").resolve() == (HERE / "skills" / "design-jeev").resolve()
        assert not (claude / "CLAUDE.md").is_symlink()
        assert (claude / "CLAUDE.md").read_text().startswith("# Global defaults")

        settings = json.loads((claude / "settings.json").read_text())
        text = json.dumps(settings)
        assert "kit/hooks" not in text, text
        dirs = settings["env"]["CLAUDE_CODE_PLUGIN_DIRS"].split(":")
        assert dirs[0].endswith("/mods/mods-pane"), dirs
        assert "~/elsewhere/mods/mine" in dirs and not any("kit/mods" in d for d in dirs), dirs
        assert sum(d.endswith("/fleet-gauge") for d in dirs) == 1
        assert settings["model"] == "opus"  # the person's value stays
        assert settings["env"]["STUDIO_GUARD_BLOCKED"] == "~/Desktop"
        assert (home / ".config/studio/voice-context").read_text() == "~/notes/voice.md\n"
        assert settings["permissions"]["allow"] == ["Bash(ls:*)"]
        assert str(HERE / "guards" / "bash_guard.py") in text and str(HERE / "guards" / "file_guard.py") in text
        assert "writing_guard.py" in text and "SessionStart" in settings["hooks"]
        assert "node studio/render.mjs" in settings["sandbox"]["excludedCommands"]

        codex = home / ".codex"
        codex_hooks = (codex / "hooks.json").read_text()
        assert "kit/hooks" not in codex_hooks and str(HERE / "guards" / "bash_guard.py") in codex_hooks
        toml = (codex / "config.toml").read_text()
        assert f'CLAUDE_CODE_PLUGIN_DIRS = "{HERE / "mods" / "fleet-gauge"}"' in toml, toml
        assert "Be plain." in (codex / "AGENTS.md").read_text()
        cursor = home / ".cursor"
        assert not (cursor / "rules" / "kit.mdc").exists() and not (cursor / "plugins" / "local" / "kit").exists()
        assert "alwaysApply: true" in (cursor / "rules" / "studio-instructions.mdc").read_text()
        assert os.readlink(cursor / "skills" / "voice") == str(HERE / "skills" / "voice")
        cursor_hooks = (cursor / "hooks.json").read_text()
        assert str(kit) not in cursor_hooks and "--cursor-native" in cursor_hooks

        again = run(home, "--settings", "--guards", "--instructions")
        assert "history:" not in again, again  # a second run changes nothing

        listing = run(home, "--history")
        entry = listing.split()[0]
        assert "settings.json" in run(home, "--diff", entry)
        run(home, "--rollback", entry)
        after = tree(home)
        assert after == before, sorted(set(after.items()) ^ set(before.items()))
        assert (kit / "skills" / "synced" / "bucket" / "SKILL.md").exists()
        assert len(run(home, "--history").splitlines()) > len(listing.splitlines())  # the rollback is kept too
    finally:
        shutil.rmtree(home, ignore_errors=True)
    print("install test ok")


if __name__ == "__main__":
    main()
