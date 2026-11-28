import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

export const LONG_SESSION = 40

const RESUME =
  /^\W*(?:co[nm][a-z]{0,2}t?[a-z]{0,2}n[a-z]?ue?w?|keep going|go on|try again|retry|updates?\??|status\??|where are we(?: at)?\??|whats? (?:next|happening)\??)\W*$/i
const QUESTION = /^\W*(?:why|what|whats|how|is|are|do|does|did|can i|should i|which|where|when|who|wait)\b/i
const WORK =
  /\b(?:fix|build|make|add|implement|create|write|clean|refactor|redesign|rename|remove|delete|merge|migrate|update|change|move|wire|polish|finish|ship|set up|setup|rebuild|install)\b/i
const CHECK =
  /\b(?:done when|done is|prove|proof|verify|verified|tests?|check|screenshot|so that|should (?:show|return|say|be|pass)|expect\w*|passes|exit code)\b/i
const WIDE =
  /\b(?:overnight|until (?:tomorrow|morning)|keep going|every single|everything|all of (?:it|them)|end to end|entire|whole (?:app|repo|thing|codebase)|from scratch)\b/i
const CLAIM =
  /\b(?:verified|tests? (?:pass|passes|passed|are green)|all green|(?:is|are|now) fixed|confirmed working|works now)\b/i
const NEGATED = /\b(?:not|never|un|isn't|wasn't|cannot|can't|without being)\s*$/i
const PROOF = /^(?:Bash|Agent|Workflow|mcp__(?:Claude_Browser|claude-in-chrome|computer-use|Claude_Code_iOS_Simulator|plugin_xcode))/

export const DONE_NOTE =
  'prompt-guard: this prompt starts work and names no check. Before any edit, state in one line what done is and which command or screenshot proves it. Ask only if you cannot infer it.'
export const RESUME_NOTE =
  'prompt-guard: before resuming, say in one line what stopped the work and what the finish line is.'
export const PLAN_NOTE =
  'prompt-guard: this prompt is wide. Propose a plan with a check per step and wait for approval before editing, unless a plan for this work was already approved in this session.'
export const longNote = (n: number): string =>
  `prompt-guard: this session has ${n} typed prompts. Say so in one line. If this prompt is a new subject, suggest a new session. If it is the same task, suggest writing the state down before a compact.`

export const notesFor = (prompt: string, typed = 0): string[] => {
  const text = prompt.trim()
  if (text === '' || text[0] === '/' || text[0] === '<') return []
  const out: string[] = []
  if (RESUME.test(text)) {
    out.push(RESUME_NOTE)
  } else if (!(QUESTION.test(text) && text.endsWith('?'))) {
    if (WIDE.test(text)) out.push(PLAN_NOTE)
    if (WORK.test(text) && text.split(/\s+/).length >= 4 && !CHECK.test(text)) out.push(DONE_NOTE)
  }
  if (typed > 0 && typed % LONG_SESSION === 0) out.push(longNote(typed))
  return out
}

export const unproven = (answer: string, ranProof: boolean): string => {
  if (ranProof) return ''
  const prose = answer
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]{1,80}"/g, ' ')
  const m = CLAIM.exec(prose)
  if (m === null || NEGATED.test(prose.slice(0, m.index))) return ''
  return m[0]
}

const typed = atom({ plugin: 'prompt-guard', key: 'typed' } as const, 0)

export const register: Register = on => {
  let ranProof = false
  let isSecondPass = false

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin') return next(e)
    ranProof = false
    isSecondPass = false
    if (e.origin.kind !== 'composer' || e.isMeta === true || e.command !== undefined) return next(e)
    const n = await update($, typed, v => v + 1)
    const notes = notesFor(e.text, n)
    if (n % LONG_SESSION === 0) $.ui.toast(`${n} prompts in this session`)
    if (notes.length === 0) return next(e)
    return next({ ...e, context: [...(e.context ?? []), ...notes] })
  })

  on('tool.call', ($, e, next) => {
    if (PROOF.test(e.tool)) ranProof = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return result
    const word = unproven(e.answer, ranProof)
    if (word === '' || isSecondPass) return result
    isSecondPass = true
    void $.prompt.submit({
      text: `prompt-guard: the last reply says "${word}" and no command or browser check ran in that turn. Run the check and show its output, or say plainly that it is not checked.`,
    })
    return result
  })
}
