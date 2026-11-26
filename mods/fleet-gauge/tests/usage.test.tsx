import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { thousands, until, usageLines, settingsOf } from '../hooks/register'

const BAND = { plugin: 'fleet-gauge', component: 'AbovePrompt', props: { hasSurvey: false } } as const
const PANE = {
  plugin: 'fleet-gauge',
  component: 'Pane',
  requestId: 'usage',
  props: {
    title: 'Usage',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const
const NOW = Date.parse('2026-11-18T10:00:00Z')
const HOUR = 3_600_000

// Stands for the engine beneath the mod: toasts and compactions are recorded.
const world = (on: On) => {
  const seen = { toasts: [] as string[], compactions: [] as (string | undefined)[] }
  const clock = mock.clock(on, { now: NOW })
  on('ui.toast', (_, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.compact', (_, e) => {
    seen.compactions.push(e.instructions)
    return { messages: [{ role: 'user', text: 'summary', toolUses: [] }] } as never
  })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>the engine's own row</Text>
  })
  return { seen, clock }
}

const measure = ($: Engine, percent: number, extra: object = {}) =>
  $.session.measure({
    context: { tokens: percent * 10_000, window: 1_000_000, percent },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 12, resetsAt: new Date(NOW + 2 * HOUR + 10 * 60_000).toISOString() },
      { kind: 'seven_day', percentUsed: 99, resetsAt: new Date(NOW + 28 * HOUR).toISOString() },
    ],
    changed: ['context', 'rateLimits'],
    ...extra,
  } as never)

const mainTurn = { answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('the band names when the weekly limit resets', async ($, on) => {
  world(on)
  await measure($, 54)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)
    expect(await ui.find({ type: 'Text', text: /week 99%, resets in 1d 4h/ })).toBeDefined()
    await ui.unmount()
  }
  const listed = await $.command.run({ command: 'fleet', args: '' } as never)
  expect((listed as { text?: string }).text).toContain('5h 12%, resets in 2h 10m')
})

test('a context just under a million reads as 1M, never 1000k', async () => {
  expect(thousands(999_600)).toBe('1M')
  expect(thousands(1_000_000)).toBe('1M')
  expect(thousands(1_500_000)).toBe('1.5M')
  expect(thousands(541_000)).toBe('541k')
  expect(until(new Date(NOW + 30 * 60_000).toISOString(), NOW)).toBe('30m')
  expect(until(undefined, NOW)).toBeUndefined()
})

test('past the threshold the band suggests compacting and one toast says so', { options: { compact_at: 50 } }, async ($, on) => {
  const { seen } = world(on)
  // 45% would pass the default of 40, so a quiet band here shows the setting is read.
  await measure($, 45)
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  expect(await ui.find({ type: 'Text', text: /compact when this step ends/ })).toBeUndefined()
  await ui.unmount()
  expect(seen.toasts).toHaveLength(0)

  await measure($, 54)
  await measure($, 55)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  const row = await ui.find({ type: 'Text', text: /context/ })
  expect(row?.text ?? 'none').toMatch(/context 550k of 1M, compact when this step ends/)
  await ui.unmount()
  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0]).toMatch(/54% of the window \(540k of 1M\)/)
})

test('auto-compact is off unless the owner turns it on', async ($, on) => {
  const { seen, clock } = world(on)
  await measure($, 90)
  await $.turn.complete(mainTurn as never)
  await clock.advance(5000)
  expect(seen.compactions).toHaveLength(0)
})

test('with auto-compact on, the main loop compacts after its turn ends; a subagent turn does not', { options: { auto_compact: true, auto_compact_at: 60 } }, async ($, on) => {
  const { seen, clock } = world(on)
  await measure($, 59)
  await $.turn.complete(mainTurn as never)
  await clock.advance(5000)
  expect(seen.compactions).toHaveLength(0)

  await measure($, 65)
  await $.turn.complete({ ...mainTurn, agentId: 'agent-1' } as never)
  await clock.advance(5000)
  expect(seen.compactions).toHaveLength(0)

  await $.turn.complete(mainTurn as never)
  expect(seen.compactions).toHaveLength(0)
  await clock.advance(2500)
  expect(seen.compactions).toHaveLength(1)
  expect(seen.compactions[0]).toMatch(/what is left to do/)
  expect(seen.toasts.some(t => /auto-compact compacted at 65%/.test(t))).toBe(true)
})

test('the usage view says what the engine does not report', () => {
  const s = settingsOf({})
  const empty = usageLines(null, null, { hasSuggested: false, isPending: false }, s, NOW)
  expect(empty.join('\n')).toMatch(/Context: no reading yet/)
  expect(empty.join('\n')).toMatch(/Week: not reported/)
  expect(empty.join('\n')).toMatch(/no credit or extra-usage balance/)
  expect(empty.join('\n')).toMatch(/Mod auto-compact: off/)
  expect(empty.join('\n')).not.toMatch(/\$\d/)

  const full = usageLines(
    {
      tokens: 541_000,
      window: 1_000_000,
      percent: 54,
      limits: [
        { kind: 'seven_day', percentUsed: 99, resetsAt: new Date(NOW + 28 * HOUR).toISOString() },
        { kind: 'spend_limit', percentUsed: 40 },
      ],
      costUsd: 41.2,
    },
    { isOn: true, threshold: 967_000 },
    { hasSuggested: true, isPending: false },
    s,
    NOW,
  ).join('\n')
  expect(full).toMatch(/Context: 541k of 1M \(54%\)/)
  expect(full).toMatch(/Week: 99% used, resets in 1d 4h/)
  expect(full).toMatch(/Five hours: not reported/)
  expect(full).toMatch(/Extra usage spend limit: 40% used, reset time not reported/)
  expect(full).toMatch(/Session cost: \$41\.20 at API prices/)
  expect(full).toMatch(/Engine auto-compact: on, at 967k/)
})

test('/gauge opens the usage pane, drawn on each surface', async ($, on) => {
  world(on)
  on('command.register', () => ({ value: { command: 'gauge' } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await measure($, 54)
  const said = await $.command.run({ command: 'gauge', args: '' } as never)
  expect((said as { text?: string }).text).toBe('Usage pane opened.')
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface } as never)
    expect(await ui.find({ type: 'Text', text: /Context: 540k of 1M \(54%\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Week: 99% used, resets in 1d 4h/ })).toBeDefined()
    await ui.unmount()
  }
})
