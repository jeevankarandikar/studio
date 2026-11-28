# Uber's agent skills, read 27 November 2026

Source: Uber Engineering on X, 23 November 2026 (https://x.com/UberEng/status/2125008806249930999), which links its X article "How Uber Evals 1 Million Agent Skill Invocations a Month". The same article is on Uber's blog at https://www.uber.com/us/en/blog/optimizing-ubers-agent-skills/, by Andrew Mager, Jason Varbedain and Uday Kiran Medisetty. It cites the Agent Skills spec (https://agentskills.io) and Cloudflare's Code Mode (https://blog.cloudflare.com/code-mode/). Uber's earlier "software factory" post was not read.

## What Uber built

Uber went from one shared skill in October 2025 to more than 5,000 a year later, invoked over a million times a month across Claude Code, Codex, OpenCode, Cursor and its own hosted agents.

- One Git repository of skills, in the agentskills.io shape: a folder with `SKILL.md`, plus scripts and references read only when a step needs them. The name and description (about 100 tokens) are always loaded, and the body is kept under 500 lines.
- Three tiers. Any team can publish a domain skill with one peer review and a CI check. Core skills are tested and owned by a team. About 100 always-on skills cover pull requests, review, tool access, data and chat for everyone from the first run.
- `aifx`, one CLI that starts each agent and installs skills and plugins into whichever agent runs next. Config merges in six layers (company, team, repository, directory, user, local override), and a later layer adds plugins without removing any.
- Telemetry from hooks. OpenTelemetry events on session start and tool calls record which skill ran, its version, and whether the agent picked it or the user typed it. Events carry no prompt text and no file contents. Each skill gets 12 measures, cost per invocation among them, computed from the session's running cost before and after the call.
- Skill Workshop, an authoring tool. A `spec.md` states the goal, outputs, required and forbidden tool actions and target models, and `SKILL.md` plus test prompts are compiled from it. A pass or fail linter requires numbered steps that each have one objective, a concrete command and a check, and an error recovery table ("'Try again' doesn't count").
- Evals. About 5% golden cases with mocks, 80% real prompts graded on trajectory (the right tools in the right order), and 15% judged by the author. They run remotely, which catches a skill that depends on its author's laptop. A suite passing 70 to 90% is often more useful than one at 100%.
- Ablation. The same real prompts replayed with and without a skill, judged blind. Most skills made sessions cheaper and more successful; the biggest wins gave agents access to something they could not find alone. Removing words was tested too.
- Cost levers. Fixed steps moved from model turns into scripts that call tools and write results to a file ("Code Mode"); they block `.mcp.json` inside skills because 100 tool definitions cost 50,000 to 70,000 tokens before the first prompt. Large tool output goes to one worker subagent on a cheaper model that returns a bounded summary. A script whose small output is always needed runs at skill load. Polling moved out of the main session to a cheap background agent, after notification turns were found to be a third of the spend in the costliest sessions.
- Papercuts. An always-on `log-papercut` skill lets any agent file what it tried, what it expected, what happened and what would fix it, without being asked. Reports group by skill on one dashboard; thousands came in over three months and hundreds were fixed. Pull requests that reviewers reject feed the eval set.

## Worth copying for one person

1. One repository is the source for every skill, guard and mod, and one installer puts them into each agent.
2. Layered config where later layers only add: shared defaults, then a repository, then the person.
3. Short descriptions and short bodies, with detail moved into references and scripts.
4. Numbered steps with a command and a check each, and an error recovery table, enforced by a linter.
5. Evals built mostly from real prompts and graded on trajectory, run in a clean home, with ablation to decide which skills and words earn their place.
6. Deterministic steps as scripts, large output kept in a worker on a cheaper model, polling off the main session.
7. A papercut log any agent can write to, read on a schedule.
8. Skill events counted from hooks with no prompt text, plus cost per invocation.

Not worth copying here: tiers, peer review, discovery ranking and personas. They solve a company's scale of authors, and one person who writes their own skills has none of those problems.
