#!/usr/bin/env python3
"""Price-weighted token report over Claude Code transcripts.

Reads every transcript under ~/.claude/projects, including the subagent and
workflow-agent files nested below each session, dedupes assistant messages by id,
and prints where a time window's spend went: by day, session, kind of agent,
model, effort, workflow and phase, then how large contexts ran and how long
agents ran. Weights are relative to uncached input.

The first version globbed `*/*.jsonl` only. Workflow agents live three levels
deeper, so it missed the 95% of a week that an overnight fleet spent.

usage: token_report.py [--days 7] [--since 2026-09-25T14] [--until 2026-10-02T14]
"""
import argparse
import glob
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

# Relative to uncached input: 5-min cache write 1.25x, 1h write 2x, read 0.1x,
# output 5x. The plan's own cap formula is not published, so shares are solid and
# totals are an approximation.
W_IN, W_5M, W_1H, W_READ, W_OUT = 1.0, 1.25, 2.0, 0.1, 5.0
ROOT = os.path.expanduser("~/.claude/projects")


def calls(since, until):
    """Yield one dict per API call inside [since, until)."""
    floor = datetime.fromisoformat(since.ljust(13, "0")[:13] + ":00:00").timestamp() - 86400
    for path in glob.glob(ROOT + "/**/*.jsonl", recursive=True):
        if os.path.getmtime(path) < floor:
            continue
        parts = path[len(ROOT) + 1:].split("/")
        if len(parts) < 2:
            continue
        kind = "main" if len(parts) == 2 else "workflow" if "workflows" in parts else "subagent"
        meta = {}
        if kind != "main":
            try:
                meta = json.load(open(path[:-6] + ".meta.json"))
            except (OSError, ValueError):
                pass
        seen = {}
        for line in open(path, errors="ignore"):
            if '"usage"' not in line or '"assistant"' not in line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            m = e.get("message") or {}
            u = m.get("usage")
            stamp = e.get("timestamp") or ""
            if e.get("type") != "assistant" or not u or "synthetic" in str(m.get("model")):
                continue
            if not since <= stamp < until:
                continue
            split = u.get("cache_creation") or {}
            w5 = split.get("ephemeral_5m_input_tokens", 0)
            w1 = split.get("ephemeral_1h_input_tokens", 0)
            if not split:
                w5 = u.get("cache_creation_input_tokens", 0)
            inp, read, out = u.get("input_tokens", 0), u.get("cache_read_input_tokens", 0), u.get("output_tokens", 0)
            # one message spans several lines; the last one carries the final usage
            seen[m.get("id")] = {
                "t": stamp, "model": m.get("model") or "?", "effort": e.get("effort") or "?",
                "project": parts[0].split("-")[-1], "session": parts[1][:8], "kind": kind,
                "workflow": parts[parts.index("workflows") + 1] if kind == "workflow" else "",
                "agent": path, "label": str(meta.get("description") or ""),
                "phase": str(meta.get("workflowPhase") or ""),
                "ctx": inp + w5 + w1 + read, "read": W_READ * read, "write": W_5M * w5 + W_1H * w1,
                "out": W_OUT * out,
                "cost": W_IN * inp + W_5M * w5 + W_1H * w1 + W_READ * read + W_OUT * out,
            }
        yield from seen.values()


def table(title, rows, key, total, top=10):
    agg = defaultdict(lambda: [0, 0.0])
    for r in rows:
        k = key(r)
        if k:
            agg[k][0] += 1
            agg[k][1] += r["cost"]
    if not agg:
        return
    print(f"\n{title}")
    for k, (n, c) in sorted(agg.items(), key=lambda kv: -kv[1][1])[:top]:
        print(f"  {str(k)[:52]:52} {n:>7} calls {c/1e6:>8.1f}M {100*c/total:>5.1f}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=float, default=7)
    ap.add_argument("--since", help="UTC, e.g. 2026-09-25T14")
    ap.add_argument("--until", help="UTC, exclusive")
    a = ap.parse_args()
    now = datetime.now(timezone.utc)
    until = a.until or (now + timedelta(hours=1)).strftime("%Y-%m-%dT%H")
    since = a.since or (now - timedelta(days=a.days)).strftime("%Y-%m-%dT%H")
    t0 = time.time()
    rows = list(calls(since, until))
    if not rows:
        return print(f"no calls between {since} and {until}")
    total = sum(r["cost"] for r in rows)
    print(f"{since} to {until} UTC: {len(rows)} calls, {total/1e6:.0f}M input-equivalent "
          f"({time.time()-t0:.0f}s to read)")
    for name, k in (("cache read", "read"), ("cache write", "write"), ("output", "out")):
        print(f"  {name:11} {100*sum(r[k] for r in rows)/total:>5.1f}%")
    print(f"  first call {min(r['t'] for r in rows)[:16]}, last call {max(r['t'] for r in rows)[:16]}")

    table("by day", rows, lambda r: r["t"][:10], total, top=14)
    table("by session", rows, lambda r: f"{r['project']}/{r['session']}", total, top=8)
    table("by kind", rows, lambda r: r["kind"], total)
    table("by model", rows, lambda r: r["model"], total)
    table("by effort", rows, lambda r: r["effort"], total)
    labels = {}
    for r in rows:
        labels.setdefault(r["workflow"], r["label"])
    table("by workflow run (first agent label)", rows,
          lambda r: r["workflow"] and f"{r['workflow']} {labels[r['workflow']]}", total)
    table("by workflow phase", rows, lambda r: r["phase"], total)

    ctx = sorted(r["ctx"] for r in rows)
    n = len(ctx)
    over = sum(1 for c in ctx if c >= 200_000)
    print(f"\ncontext per call: median {ctx[n//2]/1e3:.0f}k, p90 {ctx[n*9//10]/1e3:.0f}k, "
          f"max {ctx[-1]/1e3:.0f}k, mean {sum(ctx)/n/1e3:.0f}k")
    print(f"  calls at 200k or more: {over} of {n} ({100*over/n:.0f}%)")

    agents = defaultdict(list)
    for r in rows:
        if r["kind"] != "main":
            agents[r["agent"]].append(r)
    if agents:
        firsts = sorted(min(rs, key=lambda r: r["t"])["ctx"] for rs in agents.values())
        lengths = sorted(len(rs) for rs in agents.values())
        print(f"\n{len(agents)} subagents: first-call context median {firsts[len(firsts)//2]/1e3:.0f}k, "
              f"calls per agent median {lengths[len(lengths)//2]}, max {lengths[-1]}")
        buckets = defaultdict(lambda: [0, 0.0])
        for rs in agents.values():
            k = "1-50" if len(rs) <= 50 else "51-150" if len(rs) <= 150 else "151-300" if len(rs) <= 300 else "301+"
            buckets[k][0] += 1
            buckets[k][1] += sum(r["cost"] for r in rs)
        for k in ("1-50", "51-150", "151-300", "301+"):
            print(f"  {k:8} calls: {buckets[k][0]:>4} agents {buckets[k][1]/1e6:>8.1f}M {100*buckets[k][1]/total:>5.1f}%")
        print("  costliest agents:")
        ranked = sorted(agents.values(), key=lambda rs: -sum(r["cost"] for r in rs))[:8]
        for rs in ranked:
            c = sum(r["cost"] for r in rs)
            print(f"    {rs[0]['label'][:36]:36} {len(rs):>4} calls, peak {max(r['ctx'] for r in rs)/1e3:>4.0f}k, "
                  f"{c/1e6:>6.1f}M {100*c/total:>4.1f}%")


if __name__ == "__main__":
    main()
