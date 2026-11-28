#!/usr/bin/env python3
r"""Move old subagent and tool-result transcripts to the Trash.

A session's own file (`<project>/<uuid>.jsonl`) is the record of what the person
asked and is never touched. What piles up is beside them: `<uuid>/subagents/` and
`<uuid>/tool-results/`, agents talking to themselves. Those are kept while
they are recent, because `token_report.py` reads them, and kept at any age
when they match `--keep`, a regular expression over the raw lines, for
transcripts something else still reads (`--keep '"name":\s*"mcp__samskara__'`
keeps every Samskara tool call).

Dry run by default. Nothing is deleted: `--trash` hands paths to /usr/bin/trash.

usage: prune_transcripts.py [--days 14] [--keep REGEX] [--trash]
"""
import argparse
import glob
import os
import re
import subprocess
import time

ROOT = os.path.expanduser("~/.claude/projects")


def units():
    """One path per agent file, tool-result entry, or workflow run directory."""
    for session in glob.glob(ROOT + "/*/*/"):
        for sub in ("subagents", "tool-results"):
            d = os.path.join(session, sub)
            if not os.path.isdir(d):
                continue
            for e in os.scandir(d):
                if e.name == "workflows" and e.is_dir():
                    yield from (w.path for w in os.scandir(e.path))
                else:
                    yield e.path


def describe(path, keep):
    """(newest mtime, bytes, file count, matches --keep)"""
    files = ([os.path.join(dp, f) for dp, _, fn in os.walk(path) for f in fn]
             if os.path.isdir(path) else [path])
    newest = size = 0
    traced = False
    for fp in files:
        st = os.stat(fp)
        newest, size = max(newest, st.st_mtime), size + st.st_size
        if keep and not traced and fp.endswith(".jsonl"):
            with open(fp, "rb") as fh:
                # overlap the reads so a match split across two chunks still counts
                tail = b""
                for chunk in iter(lambda: fh.read(1 << 22), b""):
                    if keep.search(tail + chunk):
                        traced = True
                        break
                    tail = chunk[-64:]
    return newest, size, len(files), traced


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=float, default=14)
    ap.add_argument("--keep", default="")
    ap.add_argument("--trash", action="store_true")
    a = ap.parse_args()
    cutoff = time.time() - a.days * 86400
    keep = re.compile(a.keep.encode()) if a.keep else None
    go, size, count, kept, kept_size = [], 0, 0, 0, 0
    for path in units():
        newest, nbytes, nfiles, traced = describe(path, keep)
        if newest >= cutoff:
            continue
        if traced:
            kept, kept_size = kept + 1, kept_size + nbytes
            continue
        go.append(path)
        size, count = size + nbytes, count + nfiles
    print(f"older than {a.days:g} days: {len(go)} paths, {count} files, {size/1e9:.2f} GB")
    if keep:
        print(f"kept for --keep: {kept} paths, {kept_size/1e9:.2f} GB")
    if not a.trash:
        return print("dry run; pass --trash to move them to the Trash")
    for i in range(0, len(go), 100):
        subprocess.run(["/usr/bin/trash"] + go[i:i + 100], check=True)
    print(f"moved {len(go)} paths to the Trash")


if __name__ == "__main__":
    main()
