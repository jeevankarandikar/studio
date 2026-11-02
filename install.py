#!/usr/bin/env python3
"""Install studio's design skills for Claude Code, Cursor and Codex.

    python3 install.py                  the core set, for every agent found
    python3 install.py --list           show every group
    python3 install.py emil taste       the core set plus those groups
    python3 install.py --all            every group
    python3 install.py --cursor         only the agents named (--claude, --cursor, --codex)
    python3 install.py --project PATH   link into that repository instead of globally
    python3 install.py --no-guard       leave the writing guard out
    python3 install.py --remove         take out everything this clone installed
    python3 install.py --check          confirm vendored skills match their pins and licenses

Skills are links into this clone, so `git pull` updates them. Running it twice changes
nothing, and a real folder is never replaced.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = Path.home()
MANIFEST = json.loads((HERE / "skills.json").read_text())
SOURCES = {s["group"]: s for s in MANIFEST["sources"]}
CORE = MANIFEST["groups"]["core"]
FETCHED = HERE / ".fetched"
sys.path.insert(0, str(HERE / "scripts"))
# agent: (config folder, skills folder, agents folder)
AGENTS = {
    "claude": (Path(os.environ.get("CLAUDE_CONFIG_DIR") or HOME / ".claude"), None, "agents"),
    "cursor": (HOME / ".cursor", None, None),
    "codex": (Path(os.environ.get("CODEX_HOME") or HOME / ".codex"), HOME / ".agents" / "skills", None),
}


def fetch(source: dict) -> Path:
    """The upstream's skills at the pin, on this machine only. Its license bars republishing them."""
    root = FETCHED / source["id"]
    stamp = root / ".ref"
    if stamp.exists() and stamp.read_text() == source["ref"]:
        return root
    with tempfile.TemporaryDirectory(prefix="studio-fetch-") as temp:
        url = f"https://github.com/{source['repo']}"
        for args in (["init", "-q"], ["fetch", "-q", "--depth", "1", url, source["ref"]], ["checkout", "-q", "FETCH_HEAD"]):
            subprocess.run(["git", *args], cwd=temp, check=True)
        if root.exists():
            shutil.rmtree(root)
        for name, path in source["skills"].items():
            shutil.copytree(Path(temp) / path, root / name)
            for license_file in source["licenses"]:
                shutil.copy2(Path(temp) / license_file, root / name / Path(license_file).name)
    stamp.write_text(source["ref"])
    return root


def skill_paths(groups: list[str]) -> dict[str, Path]:
    found = {name: HERE / "skills" / name for name in CORE["skills"]}
    for group in groups:
        source = SOURCES[group]
        root = fetch(source) if source.get("fetch") else HERE / "skills"
        found.update({name: root / name for name in source["skills"]})
    return found


def agent_files(groups: list[str]) -> list[Path]:
    return [HERE / "agents" / Path(a).name for g in groups for a in SOURCES[g].get("agents", [])]


def ours(link: Path) -> bool:
    return link.is_symlink() and HERE in Path(os.readlink(link)).parents


def place(target: Path, source: Path) -> str:
    if target.is_symlink():
        if target.resolve() == source.resolve():
            return f"no change: {target}"
        target.unlink()
    elif target.exists():
        return f"{target} is a real folder or file, left alone. Move it away and run this again."
    target.parent.mkdir(parents=True, exist_ok=True)
    target.symlink_to(source, target_is_directory=source.is_dir())
    return f"linked {target}"


def clear(folder: Path) -> None:
    if not folder.is_dir():
        return
    for link in sorted(folder.iterdir()):
        if ours(link):
            link.unlink()
            print(f"unlinked {link}")


def destinations(chosen: list[str], project: Path | None) -> list[tuple[Path, Path | None]]:
    if project:
        return [(project / ".claude" / "skills", project / ".claude" / "agents")]
    found = []
    for agent in chosen:
        root, skills, agents = AGENTS[agent]
        found.append((skills or root / "skills", root / agents if agents else None))
    return found


def show() -> None:
    print(f"core: {CORE['about']}\n  {', '.join(CORE['skills'])}")
    for group, source in SOURCES.items():
        print(f"{group}: {source['about']} ({source['author']}, {source['license']})\n  {', '.join(source['skills'])}")


def check() -> None:
    from vendor import tree_hash

    bad = 0
    for source in MANIFEST["sources"]:
        if source.get("fetch"):
            tracked = [n for n in source["skills"] if (HERE / "skills" / n).exists()]
            bad += len(tracked)
            for name in tracked:
                print(f"FAIL {name}: its license bars republishing it, so it must not be in skills/")
            continue
        for name in source["skills"]:
            folder = HERE / "skills" / name
            problems = []
            if tree_hash(folder) != source["hashes"][name]:
                problems.append("differs from its pin")
            for license_file in source["licenses"]:
                if not (folder / Path(license_file).name).is_file():
                    problems.append(f"{Path(license_file).name} missing")
            if not (folder / "UPSTREAM.json").is_file():
                problems.append("UPSTREAM.json missing")
            for pattern in source.get("exclude", []):
                if pattern not in ("LICENSE", "NOTICE.md") and list(folder.glob(pattern)):
                    problems.append(f"{pattern} is present and must not be")
            bad += len(problems)
            print(f"{'FAIL' if problems else 'ok'} {name}{': ' + ', '.join(problems) if problems else ''}")
    raise SystemExit(1 if bad else 0)


def main() -> None:
    args = sys.argv[1:]
    if "--list" in args:
        return show()
    if "--check" in args:
        return check()
    remove = "--remove" in args
    guard = "--no-guard" not in args
    project = None
    if "--project" in args:
        at = args.index("--project")
        if at + 1 == len(args):
            raise SystemExit("--project needs a path")
        project = Path(args.pop(at + 1)).expanduser().resolve()
    named = [a for a in AGENTS if f"--{a}" in args]
    chosen = named or [a for a in AGENTS if AGENTS[a][0].is_dir()]
    if not chosen and not project:
        raise SystemExit("no Claude Code, Cursor or Codex config folder found; name one, for example --claude")
    groups = list(SOURCES) if "--all" in args else [a for a in args if not a.startswith("--")]
    for group in groups:
        if group not in SOURCES:
            raise SystemExit(f"no group called {group}; --list shows them")
    for skills, agents in destinations(chosen, project):
        if remove:
            clear(skills)
            if agents:
                clear(agents)
            continue
        for name, source in skill_paths(groups).items():
            print(place(skills / name, source))
        if agents:
            for file in agent_files(groups):
                print(place(agents / file.name, file))
    if guard and not project:
        flags = [f"--{a}" for a in chosen] + (["--remove"] if remove else [])
        subprocess.run([sys.executable, str(HERE / "writing-guard" / "install.py"), *flags], check=True)


if __name__ == "__main__":
    main()
