---
name: voice
description: >-
  Write as the person: cold emails, applications, bios, posts, DMs and replies, and
  interface text through references/apple-ui-writing.md. Reads how they actually write
  from their Samskara archive over MCP, so nothing about them lives in this skill.
  Not for commit messages.
user-invocable: true
argument-hint: "[pitch [project] | apply [company] | ui]"
---

# Voice

| Mode | What it does |
|---|---|
| `/voice` | Any writing that goes out under the person's name: emails, bios, posts, DMs, replies |
| `/voice pitch [project]` | Their own write-up of a project, from their notes |
| `/voice apply [company]` | An application: what they already sent that company, then a draft that reuses none of its sentences |
| `/voice ui` | Text a person reads inside an app; read references/apple-ui-writing.md |

The writing rules in studio's `writing-guard/RULES.md` apply on top of everything here, and the writing guard blocks the ones a pattern can catch. A project's own copy guide wins over this skill for that project's interface text.

## Steps

Each step has one objective and a check. Do not start a step until the one before it passes.

1. Name the register. Casual is texts, DMs and quick replies. Formal is email, applications, bios and long-form answers. Check: one register is named, and so is the person it goes to, if any.
2. Read their own writing in that register from Samskara. Formal: `search_life(query="", source="gmail", from_me=1, date_from=<a year ago>, date_to=<today>, limit=40)`. Casual: the same call with `source="personal"`. Writing to one person: `search_person` first, then add `person=` to the call. Writing that answers a thread: `draft_reply(conversation=<who or what>)`, whose payload carries the thread and their voice. (The exact arguments are unverified 2026-11-27 against a live archive; `documentation/mcp.md` in Samskara is the reference.) Check: at least 10 messages they wrote are in hand, or step 2 of the recovery table ran.
3. Measure the sample before writing a word: how many messages start lowercase, how many end with punctuation, the median words per message, apostrophes kept or dropped, emoji, and the words and openers they repeat. A casual register and a formal one from the same person are often near opposites, so measure the one you are writing in. Check: a one-line fingerprint is written down for yourself, with numbers.
4. Read what they keep about their own writing. If `VOICE_CONTEXT` names files (`echo "${VOICE_CONTEXT:-$(cat ~/.config/studio/voice-context 2>/dev/null)}"`, joined by `:`; studio's installer writes that file for agents whose settings do not reach the shell), read each file it names: people keep their pitches, what they submitted where and the phrases they have rejected there. For `pitch` and `apply`, also run `search_life(query=<project or company>, source="notes")`; mail they sent the company is already in step 2's source. Check: every file `VOICE_CONTEXT` names is read, and every submitted text that matches is in hand, or you have said none was found.
5. Read the facts about them from `owner_profile`: school, work, dates, links. Check: every fact in the draft comes from `owner_profile`, their own messages, their notes or the prompt. Nothing else.
6. Draft to the fingerprint and the posture below. Check: the draft's lowercase, punctuation and length sit inside the sample's range for that register.
7. Check the limits the request gave (characters, words, lines) by counting. Check: the counts are stated, and each is inside its limit.

## Recovery

| What happened | Do this |
|---|---|
| No Samskara tools in this agent | Say so in one line, write plainly to RULES.md, and invent no voice. |
| Fewer than 10 of their messages came back | Widen the dates once. If still thin, say the sample is thin and how many messages it held. |
| A call was refused or timed out | Tell the person what its sentence says. Ask again at most once, narrower, and only when the sentence says to. |
| They pasted their own draft | Edit their sentences: fix typos, add only what they asked for. A rewrite into cleaner prose is the failure they notice first. |
| A submitted application matches the company | Reuse its facts, never its sentences. |
| A limit cannot be met | Cut content and say what was cut. Never squeeze words to fit. |
| A fact is missing from every source | Leave a bracketed gap for them to fill. |

## Posture

These come from corrections people make to drafted outreach again and again. Their own messages and the files in `VOICE_CONTEXT` outrank every line here.

- Shorter. A cold email earns a reply; it does not explain everything. Defaults when their sample gives no length: cold email 90 to 150 words, essay answers 200 to 350, a short field just under its limit.
- Open with the plain move ("I saw the post and wanted to reach out"), never a thesis-style hook.
- Interest is a plain opinion in their words for liking things, taken from the sample.
- One idea per sentence. Background is a flat list of nouns with no adjectives.
- Plain verbs: built, worked on, ran. Concrete work over generalist claims.
- State a limit honestly before it can be oversold.
- Do not restate the resume they are attaching.
- Close soft and with low friction, the way their own sent mail closes.
- Formal writing is full sentences with contractions unless the sample says otherwise. Casual writing matches the fingerprint, which may mean lowercase, short and lightly punctuated.

## References

- references/apple-ui-writing.md for `/voice ui` and for any interface string written in any mode.
- references/lenses.md for a review pass over copy someone else drafted.

Read only the one the mode needs.
