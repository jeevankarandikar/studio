import { atom, read, update } from 'claude-code'
import type { PluginOptions, Register } from 'claude-code'

import type { AgentRow, CompactState, EngineCompact, Gauge, Limit } from '../types'

// An agent rereads its whole context on every call, so cost grows with the
// square of its length. In the week of 2026-09-25 the agents past 150 calls
// were 72% of the weekly cap, and the ones past 300 were 36%.
const LONG = 150
const VERY_LONG = 300
const KEEP = 80

const PANE = 'usage'
const PANE_TITLE = 'Usage'

const agents = atom({ plugin: 'fleet-gauge', key: 'agents' } as const, {})
const gauge = atom({ plugin: 'fleet-gauge', key: 'gauge' } as const, null)
const engine = atom({ plugin: 'fleet-gauge', key: 'engine' } as const, null)
const compact = atom({ plugin: 'fleet-gauge', key: 'compact' } as const, {
  hasSuggested: false,
  isPending: false,
})

const tint = (value: number, warn: number, stop: number) =>
  value >= stop ? 'red' : value >= warn ? 'yellow' : undefined

// The band is silent until a number needs a decision. /fleet and /gauge print them all.
const SHOW_AT: Record<string, number> = { seven_day: 50, five_hour: 70 }
const CONTEXT_AT = 200_000

// What a compaction the mod starts is told to keep.
const KEEP_NOTE =
  'Keep the task in hand, the files changed, the decisions made and their reasons, the checks run with their results, and what is left to do.'

export type Settings = { compactAt: number; autoCompact: boolean; autoCompactAt: number }

const percentOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && value > 0 && value <= 100 ? value : fallback

export const settingsOf = (options: PluginOptions): Settings => ({
  compactAt: percentOption(options.compact_at, 40),
  autoCompact: options.auto_compact === true,
  autoCompactAt: percentOption(options.auto_compact_at, 60),
})

export const thousands = (tokens: number): string => {
  if (tokens >= 999_500) {
    const m = tokens / 1_000_000
    return `${Number.isInteger(Math.round(m * 10) / 10) ? Math.round(m) : m.toFixed(1)}M`
  }
  return `${Math.round(tokens / 1000)}k`
}

export const percentOf = (now: Gauge | null): number | undefined => {
  if (now === null) return undefined
  if (now.percent !== undefined) return now.percent
  if (now.tokens === undefined || now.window <= 0) return undefined
  return Math.round((now.tokens / now.window) * 100)
}

export const until = (resetsAt: string | undefined, now: number): string | undefined => {
  if (resetsAt === undefined) return undefined
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return undefined
  const minutes = Math.max(0, Math.round((at - now) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

const windowName = (kind: string) =>
  kind === 'seven_day' ? 'week' : kind === 'five_hour' ? '5h' : kind === 'spend_limit' ? 'spend limit' : kind

const limitText = (l: Limit, now: number): string => {
  const left = until(l.resetsAt, now)
  return `${windowName(l.kind)} ${Math.round(l.percentUsed)}%${left === undefined ? '' : `, resets in ${left}`}`
}

function gaugeLine(now: Gauge | null, at: number): string {
  if (now === null) {
    return 'No usage reading yet.'
  }

  const parts = now.limits.map(l => limitText(l, at))

  if (now.tokens !== undefined) {
    parts.push(`context ${thousands(now.tokens)} of ${thousands(now.window)}`)
  }

  return parts.join(', ')
}

// Every line says where its figure comes from or that the engine gives none.
export function usageLines(
  now: Gauge | null,
  eng: EngineCompact,
  state: CompactState,
  s: Settings,
  at: number,
): string[] {
  const lines: string[] = []
  const pct = percentOf(now)

  if (now === null || now.tokens === undefined) {
    lines.push('Context: no reading yet. The engine reports it after the first response.')
  } else {
    lines.push(`Context: ${thousands(now.tokens)} of ${thousands(now.window)}${pct === undefined ? '' : ` (${pct}%)`}`)
  }

  const limits = now?.limits ?? []
  const week = limits.find(l => l.kind === 'seven_day')
  const hours = limits.find(l => l.kind === 'five_hour')
  const spend = limits.find(l => l.kind === 'spend_limit')
  const others = limits.filter(l => !['seven_day', 'five_hour', 'spend_limit'].includes(l.kind))
  const limitLine = (name: string, l: Limit | undefined) => {
    if (l === undefined) return `${name}: not reported. The engine's last response carried no figure for it.`
    const left = until(l.resetsAt, at)
    return `${name}: ${Math.round(l.percentUsed)}% used${left === undefined ? ', reset time not reported' : `, resets in ${left}`}`
  }
  lines.push(limitLine('Week', week))
  lines.push(limitLine('Five hours', hours))
  for (const l of others) lines.push(limitLine(l.kind, l))

  if (spend !== undefined) {
    lines.push(limitLine('Extra usage spend limit', spend))
  } else {
    lines.push('Credits: the engine gives mods no credit or extra-usage balance, so none is shown.')
  }

  lines.push(
    now?.costUsd === undefined
      ? 'Session cost: not reported by this host.'
      : `Session cost: $${now.costUsd.toFixed(2)} at API prices. On a subscription this is a measure, not a bill.`,
  )

  if (eng === null) {
    lines.push('Engine auto-compact: not read yet. Open this pane with /gauge to read it.')
  } else if (!eng.isOn) {
    lines.push('Engine auto-compact: off.')
  } else {
    lines.push(`Engine auto-compact: on${eng.threshold === undefined ? '' : `, at ${thousands(eng.threshold)}`}.`)
  }

  lines.push(`Compact suggestion: at ${s.compactAt}% of the window.`)
  lines.push(
    s.autoCompact
      ? `Mod auto-compact: on, after a turn ends at ${s.autoCompactAt}% or more.`
      : 'Mod auto-compact: off. Turn it on with fleet-gauge.auto_compact in /config.',
  )
  if (state.last !== undefined) lines.push(`Last auto-compact: ${state.last}`)

  return lines
}

function trimmed(rows: Record<string, AgentRow>): Record<string, AgentRow> {
  const entries = Object.entries(rows)

  if (entries.length <= KEEP) {
    return rows
  }

  return Object.fromEntries(
    entries.sort((a, b) => b[1].lastAt - a[1].lastAt).slice(0, KEEP),
  )
}

export const register: Register = (on, options) => {
  const s = settingsOf(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fleet',
      description: "List this session's subagents by tool calls made",
    })
    await $.command.register({
      name: 'gauge',
      description: 'Open a pane with context, weekly and five-hour usage, cost and compaction settings',
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const now: Gauge = {
      tokens: e.context.tokens,
      window: e.context.window,
      percent: e.context.percent,
      limits: e.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({
        kind,
        percentUsed,
        resetsAt,
      })),
      costUsd: e.cost?.usd,
      at: await $.clock.now(),
    }
    await update($, gauge, () => now)

    const pct = percentOf(now)
    if (pct !== undefined && now.tokens !== undefined) {
      const state = await read($, compact)
      if (pct >= s.compactAt && !state.hasSuggested) {
        await update($, compact, c => ({ ...c, hasSuggested: true }))
        $.ui.toast(
          `Context is at ${pct}% of the window (${thousands(now.tokens)} of ${thousands(now.window)}). Every call rereads it, so compact when this step ends.`,
        )
      } else if (pct < s.compactAt - 10 && state.hasSuggested) {
        await update($, compact, c => ({ ...c, hasSuggested: false }))
      }
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const id = 'agentId' in started ? started.agentId : undefined

    if (id !== undefined) {
      const at = await $.clock.now()
      await update($, agents, rows => ({
        ...rows,
        [id]: {
          calls: 0,
          isDone: false,
          ...rows[id],
          label: e.description || e.subagentType,
          lastAt: at,
        },
      }))
    }

    return started
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId

    if (id === undefined) {
      return next(e)
    }

    const at = await $.clock.now()
    let row: AgentRow = { label: id.slice(0, 8), calls: 0, lastAt: at, isDone: false }
    await update($, agents, rows => {
      row = { ...row, ...rows[id], lastAt: at, isDone: false }
      row = { ...row, calls: row.calls + 1 }

      return trimmed({ ...rows, [id]: row })
    })

    if (row.calls === LONG || row.calls === VERY_LONG) {
      $.ui.toast(
        `${row.label} has made ${row.calls} tool calls. Long agents cost the most. Consider a handoff.`,
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId

    if (id !== undefined) {
      await update($, agents, rows =>
        rows[id] ? { ...rows, [id]: { ...rows[id], isDone: true } } : rows,
      )

      return next(e)
    }

    const done = await next(e)
    const pct = percentOf(await read($, gauge))
    const state = await read($, compact)

    if (s.autoCompact && e.reason === 'answer' && pct !== undefined && pct >= s.autoCompactAt && !state.isPending) {
      await update($, compact, c => ({ ...c, isPending: true }))
      // The engine refuses a compaction while a turn runs, so wait for this one to close.
      $.clock.after(2000, () => {
        void $.session
          .compact({ instructions: KEEP_NOTE })
          .then(async r => {
            const at = await $.clock.now()
            const said =
              'skip' in r && r.skip !== undefined
                ? `skipped at ${pct}%: ${String(r.skip)}`
                : `compacted at ${pct}%`
            await update($, compact, c => ({ ...c, isPending: false, hasSuggested: false, last: `${said} (${new Date(at).toISOString().slice(0, 16)}Z)` }))
            $.ui.toast(`fleet-gauge auto-compact ${said}.`)
          })
          .catch(async (err: unknown) => {
            const why = err instanceof Error ? err.message : String(err)
            await update($, compact, c => ({ ...c, isPending: false, last: `could not run: ${why}` }))
            $.ui.toast(`fleet-gauge auto-compact could not run (${why}). It tries again after the next turn.`)
          })
      })
    }

    return done
  })

  on('command.run', { command: 'fleet' }, async $ => {
    const rows = Object.values(await read($, agents)).sort((a, b) => b.calls - a.calls)
    const head = gaugeLine(await read($, gauge), await $.clock.now())

    if (rows.length === 0) {
      return { text: `${head}\nNo subagent has made a tool call in this session.` }
    }

    return {
      text: [
        head,
        ...rows.map(
          r => `${String(r.calls).padStart(4)} calls  ${r.isDone ? 'done   ' : 'running'}  ${r.label}`,
        ),
      ].join('\n'),
    }
  })

  on('command.run', { command: 'gauge' }, async $ => {
    const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
    const b = usage?.context.breakdown
    if (b !== undefined) {
      await update($, engine, () => ({ isOn: b.isAutoCompactEnabled, threshold: b.autoCompactThreshold }))
    }
    const { isPlaced } = await $.ui.open({ id: PANE, title: PANE_TITLE })
    const lines = usageLines(await read($, gauge), await read($, engine), await read($, compact), s, await $.clock.now())

    return { text: isPlaced ? 'Usage pane opened.' : lines.join('\n') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const lines = usageLines(await read($, gauge), await read($, engine), await read($, compact), s, await $.clock.now())

    return (
      <Box flexDirection="column">
        {lines.map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, gauge)
    const rows = Object.values(await read($, agents))
    const at = await $.clock.now()

    const running = rows.filter(r => !r.isDone)
    const longest = running.reduce<AgentRow | null>(
      (top, r) => (top === null || r.calls > top.calls ? r : top),
      null,
    )
    const limits = (now?.limits ?? []).filter(l => l.percentUsed >= (SHOW_AT[l.kind] ?? 80))
    const pct = percentOf(now)
    const isCompactDue = pct !== undefined && pct >= s.compactAt
    const tokens =
      now?.tokens !== undefined && (now.tokens >= CONTEXT_AT || isCompactDue) ? now.tokens : undefined

    if (e.props.hasSurvey || (limits.length === 0 && tokens === undefined && longest === null)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const contextTint =
      pct !== undefined && pct >= Math.max(s.autoCompactAt, s.compactAt + 20)
        ? 'red'
        : isCompactDue
          ? 'yellow'
          : tint(tokens ?? 0, CONTEXT_AT, 400_000)

    return (
      <Box>
        {limits.map(limit => (
          <Text color={tint(limit.percentUsed, 50, 80)}>
            {limitText(limit, at)}{'   '}
          </Text>
        ))}
        {now !== null && tokens !== undefined && (
          <Text color={contextTint}>
            context {thousands(tokens)} of {thousands(now.window)}
            {isCompactDue ? ', compact when this step ends' : ''}{'   '}
          </Text>
        )}
        {longest !== null && (
          <Text color={tint(longest.calls, LONG, VERY_LONG)} dimColor={longest.calls < LONG}>
            {running.length} {running.length === 1 ? 'agent' : 'agents'} running, longest{' '}
            {longest.calls} calls ({longest.label})
          </Text>
        )}
      </Box>
    )
  })
}
