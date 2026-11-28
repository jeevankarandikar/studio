#!/usr/bin/env python3
"""Studio's checks. `python3 scripts/check.py`, and `--mods` to run each mod's tests too.

Exit 0 is clean, 1 is findings. It runs:

- install.py --check, which holds vendored skills to their pins and licenses;
- the skill linter on the skills studio writes itself (a folder with no UPSTREAM.json):
  frontmatter that loads, a short description, a body under 500 lines, every reference
  file named in SKILL.md, and, in a skill with a Steps section, a check on every step
  and a Recovery table;
- no `.mcp.json` in a skill or mod, since an install would load every tool it lists
  into every session;
- a scan for personal references in what studio publishes;
- every guard's selftest and the installer test against a throwaway home;
- with --mods, `claude plugin validate` and `claude plugin test` on each mod.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
FINDINGS: list[str] = []
DESCRIPTION_MAX = 600
BODY_MAX = 500
# Words that must never reach a published file, joined with ":" in STUDIO_PERSONAL_WORDS
# (your name, private repos), so the list itself is never published. A home path always counts.
PERSONAL = re.compile("|".join([r"/Users/[a-z]"] + [re.escape(w) for w in
                       os.environ.get("STUDIO_PERSONAL_WORDS", "").split(":") if w]), re.I)
PUBLISHED = ("install.py", "README.md", "agents", "guards", "mods", "scripts", "settings",
             "writing-guard", "skills")


def bad(where: str, message: str) -> None:
    FINDINGS.append(f"{where}: {message}")


def frontmatter(text: str) -> dict | None:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    found, key = {}, None
    for line in m.group(1).splitlines():
        top = re.match(r"^([\w-]+):\s*(.*)$", line)
        if top:
            key, value = top.group(1), top.group(2).strip()
            found[key] = "" if value in (">-", ">", "|", "|-") else value.strip("\"'")
        elif key and line.startswith(" "):
            found[key] = (found[key] + " " + line.strip()).strip()
    return found


def owned_skills() -> list[Path]:
    return [d for d in sorted((HERE / "skills").iterdir())
            if d.is_dir() and not (d / "UPSTREAM.json").exists()]


def lint_skill(folder: Path) -> None:
    skill = folder / "SKILL.md"
    where = f"skills/{folder.name}"
    if not skill.is_file():
        return bad(where, "no SKILL.md")
    text = skill.read_text()
    meta = frontmatter(text)
    if meta is None:
        return bad(where, "no frontmatter")
    if meta.get("name") != folder.name:
        bad(where, f"name {meta.get('name')!r} does not match the folder")
    description = meta.get("description", "")
    if not description:
        bad(where, "no description, so it never loads")
    elif len(description) > DESCRIPTION_MAX:
        bad(where, f"description is {len(description)} characters; every session pays for it, keep it under {DESCRIPTION_MAX}")
    body = text.split("\n---\n", 1)[-1]
    if len(body.splitlines()) > BODY_MAX:
        bad(where, f"body is {len(body.splitlines())} lines; move detail into references/ to stay under {BODY_MAX}")
    for sub in ("references", "reference"):
        for ref in sorted((folder / sub).glob("*.md")) if (folder / sub).is_dir() else []:
            if ref.name not in text:
                bad(f"{where}/{sub}/{ref.name}", "SKILL.md never names it, so it is never read")
    steps = re.search(r"^## Steps\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    if steps:
        numbered = re.findall(r"^\d+\.\s.*?(?=^\d+\.\s|\Z)", steps.group(1), re.S | re.M)
        if not numbered:
            bad(where, "a Steps section with no numbered steps")
        for n, step in enumerate(numbered, 1):
            if "Check:" not in step and n < len(numbered):
                bad(where, f"step {n} has no Check:")
        if not re.search(r"^## Recovery\n+\|", body, re.M):
            bad(where, "a Steps section needs a Recovery table of what goes wrong and what to do")


def check_mcp_files() -> None:
    for folder in ("skills", "mods"):
        for path in (HERE / folder).rglob(".mcp.json"):
            bad(str(path.relative_to(HERE)), "a skill or mod must not ship an .mcp.json")


def tracked() -> list[Path]:
    done = subprocess.run(["git", "-C", str(HERE), "ls-files", "-z"], capture_output=True, text=True)
    return [HERE / p for p in done.stdout.split("\0") if p]


def check_personal() -> None:
    vendored = {d.name for d in (HERE / "skills").iterdir() if (d / "UPSTREAM.json").exists()}
    for path in tracked():
        rel = path.relative_to(HERE)
        if rel.parts[0] not in PUBLISHED or (rel.parts[0] == "skills" and len(rel.parts) > 1 and rel.parts[1] in vendored):
            continue
        if path.suffix in (".png", ".jpg", ".mp4", ".woff2", ".ttf") or not path.is_file():
            continue
        for n, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
            if PERSONAL.search(line) and "github.com/" not in line:
                bad(f"{rel}:{n}", "personal reference in a published file")


def run(where: str, *command: str) -> None:
    done = subprocess.run(list(command), cwd=HERE, capture_output=True, text=True)
    if done.returncode:
        last = (done.stderr or done.stdout).strip().splitlines()[-1:] or ["no output"]
        bad(where, f"failed: {last[0]}")


def check_mods() -> None:
    claude = shutil.which("claude")
    if not claude:
        return bad("mods", "no claude on PATH to run their tests")
    env_free = ["env", "-u", "ANTHROPIC_API_KEY", claude]
    for mod in sorted((HERE / "mods").glob("*/.claude-plugin/plugin.json")):
        folder = mod.parent.parent
        run(f"mods/{folder.name} validate", *env_free, "plugin", "validate", str(folder))
        run(f"mods/{folder.name} test", *env_free, "plugin", "test", str(folder))


def main() -> None:
    py = [sys.executable, "-B"]
    run("install.py --check", *py, "install.py", "--check")
    for folder in owned_skills():
        lint_skill(folder)
    check_mcp_files()
    check_personal()
    for guard in sorted((HERE / "guards").glob("*.py")):
        run(f"guards/{guard.name}", *py, str(guard), "--selftest")
    run("writing-guard", *py, "writing-guard/writing_guard.py", "--selftest")
    run("log-papercut", *py, "skills/log-papercut/papercut.py", "--selftest")
    run("scripts/test_install.py", *py, "scripts/test_install.py")
    if "--mods" in sys.argv:
        check_mods()
    if FINDINGS:
        print(f"{len(FINDINGS)} finding(s):")
        for f in FINDINGS:
            print(f"  {f}")
        raise SystemExit(1)
    print(f"studio is clean: {len(owned_skills())} own skills linted, guards and installer pass")


if __name__ == "__main__":
    main()
