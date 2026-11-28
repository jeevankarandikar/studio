---
name: log-papercut
description: >-
  File a papercut, without being asked, the moment a skill, guard, mod, hook, MCP tool or
  script gets in the way: a wrong instruction, a false block, a missing step, a confusing
  error, a workaround you had to invent. One command, four fields. Also lists what others
  filed, so check it before inventing a workaround.
user-invocable: true
argument-hint: "[list [name]]"
---

# Log a papercut

A papercut is any time the setup made the work harder than it should have been. Filing one costs a single command and saves the next session from the same fall. File it as soon as it happens, then carry on with the task.

## Steps

1. Name what got in the way: the skill, guard, mod, hook, tool or script, by the name it goes by. Check: one name, as it appears in the setup.
2. Before inventing a workaround, read what was filed for it: `python3 <this skill's folder>/papercut.py list <name>`. Check: you have read any earlier entry and its fix, or the list was empty.
3. File it: `python3 <this skill's folder>/papercut.py add --about <name> --tried "<what you did>" --expected "<what should have happened>" --happened "<what did happen>" --fix "<what would fix it>"`. Check: the command printed `filed`.
4. Go back to the task. Mention the papercut in one line of your reply so the person knows.

Write each field as one plain sentence. Leave out prompt text, file contents, secrets and personal details: the log says what broke, never what the person was working on.

## Recovery

| What happened | Do this |
|---|---|
| The script is missing | Say so in your reply with the four fields, so the person can file it. |
| You do not know the fix | Write what you would try first; "unknown" is allowed only when you have no idea. |
| The same papercut is already filed | File it again anyway: the count is the signal. |

The person reads them grouped with `python3 <this skill's folder>/papercut.py`.
