#!/usr/bin/env python3
"""File and read papercuts: what got in an agent's way, what it tried, and what would fix it.

    python3 papercut.py add --about NAME --tried T --expected E --happened H --fix F
    python3 papercut.py list [NAME]      entries, newest first
    python3 papercut.py                  counts grouped by what they are about
    python3 papercut.py --selftest

Entries go to $STUDIO_STATE/papercuts.jsonl (default ~/.local/state/studio/papercuts.jsonl).
"""
import argparse
import json
import os
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path


def log_path() -> Path:
    state = Path(os.environ.get("STUDIO_STATE") or Path.home() / ".local" / "state" / "studio")
    return state / "papercuts.jsonl"


def entries() -> list[dict]:
    path = log_path()
    if not path.is_file():
        return []
    found = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            found.append(json.loads(line))
        except ValueError:
            continue
    return found


def add(about: str, tried: str, expected: str, happened: str, fix: str) -> dict:
    entry = {"utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "about": about.strip(),
             "tried": tried.strip(), "expected": expected.strip(), "happened": happened.strip(),
             "fix": fix.strip()}
    path = log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def show(about: str = "") -> None:
    found = [e for e in entries() if not about or e.get("about") == about]
    if not found:
        print(f"nothing filed{' about ' + about if about else ''}")
    for e in reversed(found):
        print(f"{e['utc']}  {e['about']}\n  tried: {e['tried']}\n  expected: {e['expected']}\n"
              f"  happened: {e['happened']}\n  fix: {e['fix']}")


def summary() -> None:
    counts = Counter(e.get("about", "") for e in entries())
    if not counts:
        print(f"nothing filed yet in {log_path()}")
    for about, n in counts.most_common():
        latest = max(e["utc"] for e in entries() if e.get("about") == about)
        print(f"{n:>4}  {about}  (latest {latest})")


def _selftest() -> None:
    with tempfile.TemporaryDirectory() as temp:
        os.environ["STUDIO_STATE"] = temp
        add("writing-guard", "wrote a style guide", "the quote to pass", "blocked", "list the file in WRITING_GUARD_EXEMPT")
        add("writing-guard", "a", "b", "c", "d")
        assert len(entries()) == 2 and entries()[0]["about"] == "writing-guard"
    print("selftest ok")


def main() -> None:
    if "--selftest" in sys.argv:
        return _selftest()
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command")
    a = sub.add_parser("add")
    for field in ("about", "tried", "expected", "happened", "fix"):
        a.add_argument(f"--{field}", required=True)
    l = sub.add_parser("list")
    l.add_argument("about", nargs="?", default="")
    args = ap.parse_args()
    if args.command == "add":
        add(args.about, args.tried, args.expected, args.happened, args.fix)
        print(f"filed in {log_path()}")
    elif args.command == "list":
        show(args.about)
    else:
        summary()


if __name__ == "__main__":
    main()
