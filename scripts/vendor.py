#!/usr/bin/env python3
"""Copy the third-party skills in skills.json into skills/ at their pinned commits.

    python3 scripts/vendor.py              every source, at its pin
    python3 scripts/vendor.py emil taste   only those
    python3 scripts/vendor.py --latest     move each pin to the upstream's newest commit first

Each copied folder gets the upstream license, and an UPSTREAM.json that names the author,
repository, commit and what was left out. Never edit a vendored folder by hand: the next
run overwrites it. Sources with "fetch": true are not copied here at all; install.py
fetches them onto the user's machine because their license bars redistribution.
"""
import fnmatch
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "skills.json"


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def latest(repo: str) -> str:
    out = subprocess.run(["git", "ls-remote", f"https://github.com/{repo}", "HEAD"],
                         check=True, capture_output=True, text=True).stdout
    return out.split()[0]


def checkout(repo: str, ref: str, into: Path) -> None:
    into.mkdir(parents=True)
    git("init", "-q", cwd=into)
    git("fetch", "-q", "--depth", "1", f"https://github.com/{repo}", ref, cwd=into)
    git("checkout", "-q", "FETCH_HEAD", cwd=into)


def excluded(relative: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(relative, p) or relative.startswith(p.rstrip("/") + "/") for p in patterns)


def copy_tree(source: Path, target: Path, exclude: list[str]) -> None:
    if target.exists():
        shutil.rmtree(target)
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source).as_posix()
        if path.is_symlink():
            raise SystemExit(f"{source}: symlink refused: {relative}")
        if path.is_dir() or path.name == ".DS_Store" or excluded(relative, exclude):
            continue
        out = target / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, out)


def patch(folder: Path, patches: dict) -> None:
    for name, edits in patches.items():
        path = folder / name
        text = path.read_text()
        for old, new in edits:
            if old not in text:
                raise SystemExit(f"{path}: patch no longer applies: {old!r}")
            text = text.replace(old, new)
        path.write_text(text)


def tree_hash(folder: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        if path.name != ".DS_Store":
            digest.update(path.relative_to(folder).as_posix().encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()[:16]


def vendor(source: dict) -> None:
    with tempfile.TemporaryDirectory(prefix="studio-vendor-") as temp:
        upstream = Path(temp) / "upstream"
        checkout(source["repo"], source["ref"], upstream)
        hashes = {}
        for name, path in source["skills"].items():
            folder = ROOT / "skills" / name
            copy_tree(upstream / path, folder, source.get("exclude", []))
            patch(folder, source.get("patches", {}).get(name, {}))
            for license_file in source["licenses"]:
                shutil.copy2(upstream / license_file, folder / Path(license_file).name)
            for extra in source.get("extra_licenses", []):
                shutil.copy2(ROOT / extra, folder / Path(extra).name)
            (folder / "UPSTREAM.json").write_text(json.dumps({
                "author": source["author"],
                "repo": source["repo"],
                "ref": source["ref"],
                "path": path,
                "license": source["license"],
                "left_out": source.get("exclude", []),
                "changed": sorted(source.get("patches", {}).get(name, {})),
            }, indent=2) + "\n")
            hashes[name] = tree_hash(folder)
        source["hashes"] = hashes
        for agent in source.get("agents", []):
            target = ROOT / "agents" / Path(agent).name
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(upstream / agent, target)
    print(f"{source['id']}: {len(hashes)} skill(s) at {source['ref'][:7]}")


def main() -> None:
    args = sys.argv[1:]
    move = "--latest" in args
    chosen = [a for a in args if not a.startswith("--")]
    manifest = json.loads(MANIFEST.read_text())
    for source in manifest["sources"]:
        if chosen and source["id"] not in chosen:
            continue
        if move:
            source["ref"] = latest(source["repo"])
        if source.get("fetch"):
            print(f"{source['id']}: fetched at install, nothing to copy")
            continue
        vendor(source)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
