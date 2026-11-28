#!/usr/bin/env python3
"""PreToolUse guard for Bash in Claude Code, Codex and Cursor.

A rule earns a place here when it is decidable from the command text alone, the
failure is irreversible, and there is no legitimate reason to want the exception.
Rules that fail the last test belong in prose, where judgment can apply. Rules that
block read-only work are worse than no rule: they train the agent to route around
the guard.

What it blocks: irreversible git, a force-deleted branch, dropped or truncated tables,
flags that skip hooks, recursive rm outside temp and build folders, and shell writes
or new repositories where file_guard.py would refuse a file. With
STUDIO_GUARD_TRAILERS=deny in settings it also refuses commit trailers.

The agent gets stdin as JSON. Exit 2 blocks the call and returns stderr to the agent;
exit 0 allows. Run `bash_guard.py --selftest` to check.
"""
import json
import os
import re
import sys

# Shell writes walk around a guard that only sees Write and Edit, so the path verdict
# is imported, never restated: two copies of one rule drift apart.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from file_guard import verdict as _path_verdict  # noqa: E402

# A trailer is a line that starts with the token. Matching the token anywhere blocked
# `grep -rln "Co-Authored-By"` and a commit whose message described that bug.
TRAILER_LINE = re.compile(r"^\s*(co-authored-by|signed-off-by)\s*:", re.I | re.M)

TMP_OK = ("/tmp/", "/private/tmp/", "/private/var/folders/", "/var/folders/")

# Blocking rm on what a build regenerates made cleaning painful enough to route around.
REGENERABLE = {
    "node_modules", ".next", ".nuxt", "dist", "build", ".build", "out",
    ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", "target", ".turbo", ".parcel-cache", "DerivedData",
}

DESTRUCTIVE_GIT = (
    "git reset --hard", "git push --force", "git push -f",
    "git clean -fd", "git checkout -- .", "git filter-repo",
    "git branch -d main", "git branch -d master",
)

HOOK_BYPASS = ("--no-verify", "--no-gpg-sign")

# DDL counts only when a database client runs it; the bare words blocked
# `grep -r "drop table" migrations/`.
DB_DESTRUCTIVE = re.compile(
    r"\b(psql|sqlite3|mysql|mariadb|duckdb|pg_dump)\b[^;|&]*"
    r"\b(drop|truncate)\s+table\b", re.I)

NEW_REPO = re.compile(r"\b(mkdir|git\s+clone|git\s+init|create-next-app|degit|cookiecutter)\b(.*)$")

REDIRECT = re.compile(r">>?\s*([^\s;|&<>]+)")
HEREDOC = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n(.*?)(?:\n\1\s*(?:\n|$)|$)", re.S)
PATHLIKE = re.compile(r"[~/]|\$\{?HOME\b")


def _quoted_mask(command: str) -> list:
    """True for every character inside quotes or a heredoc body.

    A `>` there is text handed to another program (`python3 -c '... n>=2 ...'`), and
    reading it as a redirect blocked read-only analysis as a write to a file named `=2`.
    """
    mask = [False] * len(command)
    for m in HEREDOC.finditer(command):
        for i in range(m.start(2), m.end(2)):
            mask[i] = True
    quote = None
    for i, ch in enumerate(command):
        if mask[i] and quote is None:
            continue
        if quote:
            mask[i] = True
            if ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
            mask[i] = True
    return mask


def _redirect_targets(command: str):
    """Outside quotes every redirect target counts; inside, only one that looks like a path."""
    mask = _quoted_mask(command)
    out = []
    for m in REDIRECT.finditer(command):
        target = m.group(1).strip("'\"")
        if not target:
            continue
        if mask[m.start()] and not PATHLIKE.match(target):
            continue
        out.append(target)
    return out


def _write_targets(command: str):
    """Paths a shell command would write: redirects, tee, cp, mv, rsync, install, curl -o."""
    out = _redirect_targets(command)
    for seg in (s.strip() for s in re.split(r"[;|&]+", command)):
        if not seg:
            continue
        tee = re.search(r"\btee\b((?:\s+-\w+)*)\s+([^\s;|&]+)", seg)
        if tee:
            out.append(tee.group(2))
        fetch = re.search(r"\b(?:curl|wget)\b.*?\s-[oO]\s+([^\s;|&]+)", seg)
        if fetch:
            out.append(fetch.group(1))
        copy = re.match(r"(?:sudo\s+)?(?:cp|mv|rsync|install)\b(.*)$", seg)
        if copy:
            args = [a for a in copy.group(1).split() if not a.startswith("-")]
            if len(args) >= 2:
                out.append(args[-1])
        new = NEW_REPO.search(seg)
        if new:
            out += [a.rstrip("/") + "/x" for a in new.group(2).split() if PATHLIKE.match(a)]
    return [t.strip("'\"") for t in out if t]


def _rm_targets(command: str):
    body = re.sub(r"^.*?\brm\s+(-[a-zA-Z]+\s+)*", "", command, count=1, flags=re.S)
    body = re.split(r"[;|&]", body, maxsplit=1)[0]
    return [w.strip("'\"") for w in body.split() if w and not w.startswith("-")]


def verdict(command: str, cwd: str = ""):
    """return (exit_code, message). 2 = block, 0 = allow."""
    if not isinstance(command, str) or not command.strip():
        return 0, ""
    low = command.lower()

    if (os.environ.get("STUDIO_GUARD_TRAILERS") == "deny" and "git commit" in low
            and (TRAILER_LINE.search(command) or "--trailer" in low)):
        return 2, ("BLOCKED: commit trailers are off in this setup. Remove the "
                   "Co-Authored-By or Signed-off-by line and retry.")

    hit = next((p for p in DESTRUCTIVE_GIT if p in low), None)
    if hit:
        return 2, (f"BLOCKED: {hit!r} is irreversible. If it is wanted, the user runs "
                   "it, and that is the confirmation.")
    if re.search(r"git\s+branch\s+(-[a-zA-Z]*D)", command):
        return 2, ("BLOCKED: git branch -D force-deletes unmerged work. "
                   "-d on merged branches is fine.")
    if DB_DESTRUCTIVE.search(command):
        return 2, "BLOCKED: dropping or truncating a table. The user runs this."

    bypass = next((f for f in HOOK_BYPASS if f in low), None)
    if bypass:
        return 2, (f"BLOCKED: {bypass} skips hooks. A failing hook is a signal to read; "
                   "only the user may bypass it.")

    for target in _write_targets(command):
        code, message = _path_verdict(target, cwd)
        if code == 2:
            return 2, message

    if re.search(r"\brm\s+-[a-zA-Z]*[rR]", command):
        targets = _rm_targets(command)
        scratch = os.environ.get("CLAUDE_SCRATCHPAD", "")

        def disposable(p: str) -> bool:
            if p.startswith(TMP_OK) or (scratch and p.startswith(scratch)):
                return True
            return os.path.basename(p.rstrip("/")) in REGENERABLE

        if not targets or not all(disposable(p) for p in targets):
            return 2, ("BLOCKED: recursive rm outside temp and build folders. Move it to "
                       "the Trash instead (`trash` on macOS), so the user can review it.")
    return 0, ""


def _selftest() -> None:
    saved = {k: os.environ.get(k) for k in ("STUDIO_GUARD_BLOCKED", "STUDIO_GUARD_PROJECTS", "STUDIO_GUARD_TRAILERS")}
    home = os.path.expanduser("~")
    try:
        for key in saved:
            os.environ.pop(key, None)
        assert verdict("git commit --trailer 'Co-Authored-By: x'")[0] == 0  # trailers allowed by default
        assert verdict("echo x > ~/Desktop/a.md")[0] == 0  # no folders set
        os.environ["STUDIO_GUARD_TRAILERS"] = "deny"
        os.environ["STUDIO_GUARD_BLOCKED"] = "~/Desktop:~/Downloads:~/Documents"
        os.environ["STUDIO_GUARD_PROJECTS"] = "~/Developer/GitHub"
        assert verdict("git commit --trailer 'Co-Authored-By: x'")[0] == 2
        assert verdict("git push --force origin main")[0] == 2
        assert verdict("rm -rf /")[0] == 2
        assert verdict("git commit -m 'normal message'")[0] == 0
        assert verdict("ls -la && git status")[0] == 0
        assert verdict("")[0] == 0
        assert verdict('grep -rln "Co-Authored-By" .')[0] == 0
        assert verdict("git log --grep=Signed-off-by")[0] == 0
        assert verdict('git commit -m "fix guard that blocked Co-Authored-By greps"')[0] == 0
        assert verdict('git commit -m "msg" -m "body\nCo-Authored-By: x <a@b.c>"')[0] == 2
        assert verdict('git commit --trailer "Signed-off-by: x"')[0] == 2
        assert verdict('grep -r "drop table" migrations/')[0] == 0
        assert verdict('echo "dd if=x"')[0] == 0
        assert verdict("rm -rf node_modules")[0] == 0
        assert verdict("rm -rf .next dist")[0] == 0
        assert verdict(f"rm -rf {home}/proj/build")[0] == 0
        assert verdict('sqlite3 data/app.db "DROP TABLE messages"')[0] == 2
        assert verdict(f"rm -rf {home}/Developer/foo")[0] == 2
        assert verdict("rm -rf src/")[0] == 2
        assert verdict("rm -rf /tmp/scratch")[0] == 0
        assert verdict("rm -r /private/tmp/x && ls")[0] == 0
        assert verdict("rm notes.txt")[0] == 0
        assert verdict("git commit --no-verify -m 'x'")[0] == 2
        assert verdict("git branch -D feature")[0] == 2
        assert verdict("git branch -d feature")[0] == 0
        assert verdict("git filter-repo --path secrets")[0] == 2
        assert verdict(f"mkdir -p {home}/Developer/newproj")[0] == 2
        assert verdict("mkdir -p ~/Developer/GitHub/newproj")[0] == 0
        assert verdict(f"git clone x {home}/Documents/GitHub/y")[0] == 2
        assert verdict(f"ls {home}/Developer/screenshots")[0] == 0
        assert verdict("mkdir -p build/out")[0] == 0
        assert verdict("echo x > ~/Desktop/a.md")[0] == 2
        assert verdict("ls | tee ~/Documents/out.txt")[0] == 2
        assert verdict("cp build/app ~/Downloads/app")[0] == 2
        assert verdict("curl -sS -o ~/Downloads/x.zip https://e.com/x.zip")[0] == 2
        assert verdict("cat notes.md >> ~/Desktop/journal.md")[0] == 2
        assert verdict("mv old.txt ~/Developer/GitHub/repo/new.txt")[0] == 0
        assert verdict("echo x > /tmp/a")[0] == 0
        assert verdict("ls -la > /dev/null 2>&1")[0] == 0
        assert verdict("cat ~/Desktop/notes.md")[0] == 0
        assert verdict("ls ~/Downloads")[0] == 0
        dev = f"{home}/Developer"
        assert verdict("python3 -c 'if n>=2: pass'", dev)[0] == 0
        assert verdict('python3 -c \'x = m.get("model")=="<synthetic>"\'', dev)[0] == 0
        assert verdict("python3 - <<'EOF'\nif n>=2: print(n)\nEOF", dev)[0] == 0
        assert verdict('bash -c "echo x > ~/Desktop/a.md"')[0] == 2
        assert verdict("echo 'a>b' > ~/Desktop/a.md")[0] == 2
        assert verdict("cat <<EOF > ~/Desktop/a.md\nhi\nEOF")[0] == 2
        assert verdict("python3 - <<'EOF'\nx=1\nEOF\necho x > ~/Desktop/a.md")[0] == 2
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
    if "cursor_version" in event and "--cursor-native" not in sys.argv:
        return
    # Claude Code and Codex put the command in tool_input; Cursor's beforeShellExecution
    # puts it at the top level.
    tool_input = event.get("tool_input") or event.get("input") or {}
    command = event.get("command") or tool_input.get("command", "")
    cwd = event.get("cwd") or tool_input.get("cwd") or os.getcwd()
    cursor_style = "tool_input" not in event and "command" in event
    code, message = verdict(command, cwd)
    if code == 2:
        print(message, file=sys.stderr)
        if cursor_style:
            # Both spellings: Cursor's schema has been documented both ways, and a deny
            # with no reason text tells the agent nothing.
            print(json.dumps({
                "permission": "deny",
                "userMessage": message,
                "agentMessage": message,
                "user_message": message,
                "agent_message": message,
            }))
    elif cursor_style:
        print(json.dumps({"permission": "allow"}))
    sys.exit(code)


if __name__ == "__main__":
    main()
