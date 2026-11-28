# prompt-guard

A Claude Code mod that gives every task a finish line. It reads each prompt typed in the composer and adds a note beside it for the model:

- A prompt of four words or more that asks for work (fix, build, rename, ship and the like) and names no check gets a note asking the model to say what done is and which command or screenshot proves it.
- A bare resume such as "continue", "try again" or "status?" gets a note asking what stopped the work and where it ends. Common typos of "continue" count.
- A wide prompt ("overnight", "everything", "from scratch", "end to end") gets a note asking for a plan with a check per step, held for approval.
- Every 40th typed prompt in a session gets a note suggesting a new session, or writing the state down before a compact, and a toast with the count.

A question that ends in "?", a slash command, a machine message that starts with `<`, and a prompt sent by another mod get no note.

## The second pass

When a reply says "verified", "tests pass", "all green", "is fixed" or "works now" and no Bash, Agent, Workflow, browser, computer-use, simulator or Xcode tool ran in that turn, the mod sends one follow-up prompt asking the model to run the check and show its output, or to say plainly that it is not checked. Code blocks, inline code, short quotes and a negated claim ("not verified") do not count. It asks once per prompt.

Run `claude plugin test .` in this folder after an edit.
