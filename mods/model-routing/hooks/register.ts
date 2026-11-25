import type { Register } from 'claude-code'

// Anthropic's guidance (claude-api skill, cached 2026-11-03): Opus is the default,
// Sonnet for high-volume work, Haiku for simple fast work, Fable only for the
// hardest; measure the stronger model at lower effort before a cheaper cascade.

export type Tier = 'haiku' | 'sonnet' | 'opus' | 'fable'

export type Route = {
  tier: Tier
  name: string
  id: string
  price: string
  effort: string
  fits: string
  difficulty: string
  novelty: string
  volume: string
  mistake: string
}

export const ROUTES: readonly Route[] = [
  {
    tier: 'haiku',
    name: 'Haiku 5.5',
    id: 'claude-haiku-5-5',
    price: '0.10, 0.50',
    effort: 'low',
    fits: 'Mechanical, high-volume, checkable by rule: file sweeps, sorting, log triage, reformatting, rule-scored grading.',
    difficulty: 'mechanical',
    novelty: 'done many times before',
    volume: 'hundreds of calls',
    mistake: 'a rule or a diff catches it',
  },
  {
    tier: 'sonnet',
    name: 'Sonnet 5.5',
    id: 'claude-sonnet-5-5',
    price: '2, 10',
    effort: 'medium',
    fits: 'Routine work with a clear spec: research readers and finders, test fixing, bulk edits, benchmark answering.',
    difficulty: 'routine with a clear spec',
    novelty: 'a known pattern',
    volume: 'many calls',
    mistake: 'a test catches it',
  },
  {
    tier: 'opus',
    name: 'Opus 5.5',
    id: 'claude-opus-5-5',
    price: '4, 20',
    effort: 'medium, high for hard code',
    fits: 'The default: changes across files, code review, merges, synthesis, running other agents.',
    difficulty: 'hard, across files',
    novelty: 'some new ground',
    volume: 'a few long runs',
    mistake: 'a review catches it',
  },
  {
    tier: 'fable',
    name: 'Fable 5.2',
    id: 'claude-fable-5-2',
    price: '8, 40',
    effort: 'high to start',
    fits: 'New or open-ended work where mistakes cost most: research and development, design judgment, deep audits, long autonomous runs.',
    difficulty: 'open-ended',
    novelty: 'new',
    volume: 'few calls, long thinking',
    mistake: 'costly or hard to see',
  },
]

const RANK: Record<Tier, number> = { haiku: 0, sonnet: 1, opus: 2, fable: 3 }

const row = (cells: string[]): string => `| ${cells.join(' | ')} |`

export const TABLE = [
  'Model routing for agents and sessions you start',
  '',
  'Pick the model by four things: how hard the task is, how routine or new it is, how many calls it makes, and what a mistake costs. Effort is the second lever: a stronger model at lower effort often beats a weaker one at high.',
  '',
  row(['Model', 'Dollars per million tokens in, out', 'Fits', 'Effort']),
  row(['---', '---', '---', '---']),
  ...ROUTES.map(r => row([`${r.name} (${r.tier}, ${r.id})`, r.price, r.fits, r.effort])),
  '',
  row(['', ...ROUTES.map(r => r.name)]),
  row(['---', ...ROUTES.map(() => '---')]),
  row(['Difficulty', ...ROUTES.map(r => r.difficulty)]),
  row(['Novelty', ...ROUTES.map(r => r.novelty)]),
  row(['Volume', ...ROUTES.map(r => r.volume)]),
  row(['A mistake', ...ROUTES.map(r => r.mistake)]),
  '',
  'Name the model on every Agent call (`model`: haiku, sonnet, opus or fable) and every fresh session you start (`model`: the full id, such as claude-sonnet-5-5; the app ignores one above your own). A fork inherits yours, so it needs none. Say which model and why in the line before the call. A judge comes from another vendor than the model it grades when one is available.',
].join('\n')

const SESSION_TOOL = 'mcp__ccd_session__start_session'

export const tierOf = (model: string): Tier | undefined => {
  const found = /(haiku|sonnet|opus|fable)/i.exec(model)?.[1]?.toLowerCase()
  return found as Tier | undefined
}

// Words read from the short label of the call (Agent's description and type, a
// session's title), never the prompt, which names everything.
const MECHANICAL = /\b(find|finds|finder|list|lists|grep|sweep|count|sort|rename|reformat|format|triage|extract|lookup|locate|scan|inventory)\b/i
const HIGH_STAKES = /\b(design|architect\w*|audit|security|review|merge|migrat\w*|refactor\w*|judge|debug\w*|plan|incident)\b/i

export const label = (tool: string, input: Record<string, unknown>): string => {
  const parts = tool === 'Agent' ? [input.description, input.subagent_type] : [input.title]
  return parts.filter((p): p is string => typeof p === 'string').join(' ')
}

export const needsModel = (tool: string, input: Record<string, unknown>): boolean => {
  if (typeof input.model === 'string' && input.model !== '') return false
  if (tool === 'Agent') return input.subagent_type !== 'fork'
  if (tool === SESSION_TOOL) {
    if (input.proposal_id) return false
    if (input.initiation === 'offer') return false
    if (input.context === 'fork') return false
    // A cloud session takes no model, and a preset brings its own.
    if (input.target === 'cloud') return false
    if (typeof input.preset === 'string' && input.preset !== '') return false
    return true
  }
  return false
}

const idOf = (tier: Tier): string => ROUTES.find(r => r.tier === tier)?.id ?? tier

// A named model that does not fit the call, or undefined when it fits or the
// mod cannot tell. `own` is the session's own model, as $.session.model() reads.
export const misfit = (tool: string, input: Record<string, unknown>, own: string): string | undefined => {
  if (typeof input.model !== 'string' || input.model === '') return undefined
  const picked = tierOf(input.model)
  if (picked === undefined) return undefined
  const isSession = tool === SESSION_TOOL
  const say = (t: Tier) => (isSession ? idOf(t) : t)
  const mine = tierOf(own)
  if (isSession && mine !== undefined && RANK[picked] > RANK[mine]) {
    return `the app ignores a session model above your own (${own}), so ${input.model} would not apply; pick ${say(mine)} or cheaper, or drop the model to inherit yours`
  }
  if (isSession && !/^claude-/.test(input.model)) {
    return `start_session takes a full model id, such as ${idOf(picked)}, not ${input.model}`
  }
  const words = label(tool, input)
  if (picked === 'haiku' && HIGH_STAKES.test(words)) {
    return `"${words}" reads as review, design or audit work, where a mistake costs more than Haiku saves; ${say('opus')} fits`
  }
  if (picked === 'fable' && MECHANICAL.test(words) && !HIGH_STAKES.test(words)) {
    return `"${words}" reads as mechanical work, where Fable costs 80 times Haiku for the same result; ${say('haiku')} or ${say('sonnet')} fits`
  }
  return undefined
}

const ASK = (tool: string): string =>
  tool === 'Agent'
    ? 'model-routing: this agent names no model, so it would inherit yours or its type\'s default. Choose one from the routing table in the system prompt (haiku for mechanical, sonnet for routine, opus for the default, fable for new and costly) and send the call again with it. To keep the default on purpose, send the same call again unchanged and it goes through.'
    : 'model-routing: this session names no model, so it would inherit yours. Choose a full model id from the routing table in the system prompt (claude-haiku-5-5 for mechanical, claude-sonnet-5-5 for routine, claude-opus-5-5 for the default) and send the call again with it. To keep yours on purpose, send the same call again unchanged and it goes through.'

const FIT = (why: string): string =>
  `model-routing: ${why}. Send the call again with another model, or send it unchanged to keep this one.`

export const key = (tool: string, input: Record<string, unknown>): string => {
  const { tool_use_id: _id, consent: _consent, tool: _tool, ...rest } = input
  return `${tool} ${JSON.stringify(rest)}`
}

export const register: Register = on => {
  const asked = new Set<string>()

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return { sections: [...composed.sections, { id: 'model-routing:table', text: TABLE, scope: 'session' }] }
  })

  // Ask once; the same call sent again goes through, so the model keeps the last word.
  const once = (k: string, deny: string): { deny: string } | undefined => {
    if (asked.has(k)) {
      asked.delete(k)
      return undefined
    }
    asked.add(k)
    return { deny }
  }

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const why = needsModel('Agent', input) ? ASK('Agent') : misfit('Agent', input, await $.session.model().catch(() => ''))
    if (why === undefined) return next(e)
    const held = once(key('Agent', input), why.startsWith('model-routing') ? why : FIT(why))
    return held ?? next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: /^mcp__ccd_session__start_session$/ }, async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const why = needsModel(SESSION_TOOL, input) ? ASK(SESSION_TOOL) : misfit(SESSION_TOOL, input, await $.session.model().catch(() => ''))
    if (why === undefined) return next(e)
    const held = once(key(SESSION_TOOL, input), why.startsWith('model-routing') ? why : FIT(why))
    return held ?? next(e)
  }).catch(($, e, next) => next(e))
}
