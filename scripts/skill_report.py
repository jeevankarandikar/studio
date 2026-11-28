#!/usr/bin/env python3
"""Uses and tokens per skill, from guards/skill_events.py's log and the session transcripts.

    python3 scripts/skill_report.py            every skill in the log
    python3 scripts/skill_report.py --days 7   only the last week

A use's tokens are the API calls from the moment it was recorded to the person's next
message in that session, weighted the way token_report.py weights them (output 5x,
cache reads 0.1x). The window holds the turns the skill caused and anything else the
model did before the person spoke again, so compare one skill before and after a
change, not one skill with another.
"""
import argparse
import glob
import json
import os
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from token_report import W_1H, W_5M, W_IN, W_OUT, W_READ  # noqa: E402

STATE = Path(os.environ.get("STUDIO_STATE") or Path.home() / ".local" / "state" / "studio")
PROJECTS = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude") / "projects"


def stamp(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def weighted(usage: dict) -> float:
    cache = usage.get("cache_creation") or {}
    w5 = cache.get("ephemeral_5m_input_tokens", usage.get("cache_creation_input_tokens", 0))
    w1 = cache.get("ephemeral_1h_input_tokens", 0)
    return (W_IN * usage.get("input_tokens", 0) + W_5M * w5 + W_1H * w1
            + W_READ * usage.get("cache_read_input_tokens", 0) + W_OUT * usage.get("output_tokens", 0))


def is_prompt(line: dict) -> bool:
    if line.get("type") != "user" or line.get("isMeta"):
        return False
    content = (line.get("message") or {}).get("content")
    if isinstance(content, list):
        return not any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content)
    return isinstance(content, str)


def turns(session: str):
    """(time, kind, weight) for each API call and person's message in one session."""
    found = []
    for path in glob.glob(str(PROJECTS / "*" / f"{session}.jsonl")):
        with open(path, encoding="utf-8", errors="replace") as f:
            for raw in f:
                try:
                    line = json.loads(raw)
                except ValueError:
                    continue
                if "timestamp" not in line:
                    continue
                if line.get("type") == "assistant":
                    usage = (line.get("message") or {}).get("usage")
                    if usage:
                        found.append((stamp(line["timestamp"]), "call", weighted(usage)))
                elif is_prompt(line):
                    found.append((stamp(line["timestamp"]), "prompt", 0.0))
    return sorted(found)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=float, default=0)
    a = ap.parse_args()
    log = STATE / "events.jsonl"
    if not log.is_file():
        raise SystemExit(f"no {log} yet; guards/skill_events.py writes it once install.py --settings wires it")
    since = datetime.now(timezone.utc) - timedelta(days=a.days) if a.days else None
    uses = [json.loads(x) for x in log.read_text().splitlines() if x.strip()]
    uses = [u for u in uses if not since or stamp(u["utc"]) >= since]
    cache: dict[str, list] = {}
    per = defaultdict(lambda: {"model": 0, "user": 0, "tokens": []})
    for use in uses:
        rows = cache.setdefault(use["session"], turns(use["session"]))
        start = stamp(use["utc"])
        total = 0.0
        for when, kind, weight in rows:
            if when < start:
                continue
            if kind == "prompt" and when > start + timedelta(seconds=2):
                break
            total += weight
        entry = per[use["skill"]]
        entry[use["by"]] += 1
        entry["tokens"].append(total)
    print(f"{'skill':<28}{'by model':>9}{'typed':>7}{'median':>12}{'total':>14}")
    for skill, e in sorted(per.items(), key=lambda kv: -sum(kv[1]["tokens"])):
        median = statistics.median(e["tokens"]) if e["tokens"] else 0
        print(f"{skill:<28}{e['model']:>9}{e['user']:>7}{median:>12,.0f}{sum(e['tokens']):>14,.0f}")
    print("tokens are weighted the way token_report.py weights them")


if __name__ == "__main__":
    main()
