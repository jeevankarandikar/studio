import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { merge, parseFailure } from '../hooks/register'

const PANE = {
  plugin: 'mods-pane',
  component: 'Pane',
  requestId: 'mods',
  props: {
    title: 'Mods',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const FILES: Record<string, string> = {
  '/home/me/mods/fleet-gauge/.claude-plugin/plugin.json': JSON.stringify({ name: 'fleet-gauge', version: '0.2.0', description: 'Usage above the prompt.' }),
  '/home/me/mods/model-routing/.claude-plugin/plugin.json': JSON.stringify({ name: 'model-routing', description: 'Routes agents to a model.' }),
  '/home/me/.claude/plugins/marketplaces/official/plugins/figma/.claude-plugin/plugin.json': JSON.stringify({ name: 'figma', description: 'Figma tools.' }),
}

// Stands for the engine and the disk beneath the pane.
const world = (on: On) => {
  mock.clock(on, { now: Date.parse('2026-11-18T10:00:00Z') })
  mock.env(on, {
    HOME: '/home/me',
    CLAUDE_CODE_PLUGIN_DIRS: '~/mods/fleet-gauge:~/mods/model-routing:~/mods/gone',
  })
  on('fs.read', (_, e) => {
    const text = FILES[e.path] ?? (e.path.includes('/mods-pane/') ? JSON.stringify({ name: 'mods-pane', description: 'Lists mods.' }) : undefined)
    return (text === undefined ? { deny: `ENOENT ${e.path}` } : { value: text }) as never
  })
  on('settings.read', () => ({ value: { enabledPlugins: { 'figma@official': true, 'slack@official': false } } }) as never)
  on('command.register', () => ({ value: { command: 'mod-list' } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }) as never)
}

const start = ($: { session: { start: (e: never) => Promise<unknown> } }) =>
  $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)

test('the pane lists folder mods, settings plugins and itself, on every surface', async ($, on) => {
  world(on)
  await start($)
  const said = await $.command.run({ command: 'mod-list', args: '' } as never)
  expect((said as { text?: string }).text).toBe('Mods pane opened.')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface } as never)
    expect((await ui.find({ type: 'Text', text: /^fleet-gauge 0\.2\.0/ }))?.text).toMatch(/listed, load not seen/)
    expect(await ui.find({ type: 'Text', text: /Usage above the prompt\./ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^mods-pane/ }))?.text).toMatch(/ on$/)
    expect(await ui.find({ type: 'Text', text: /No plugin\.json found in this folder/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^slack/ }))?.text).toMatch(/off/)
    expect((await ui.find({ type: 'Text', text: /^figma/ }))?.text).toMatch(/on in settings/)
    await ui.unmount()
  }
})

test(
  'a mod that loads after the pane is seen joining and shows as on',
  { plugins: [{ name: 'late-mod', register(on) { on('tool.call', ($, e, next) => next(e)) } }] },
  async ($, on) => {
    world(on)
    await start($)
    // A later survey must not undo what a join showed.
    await $.command.run({ command: 'mod-list', args: '' } as never)

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
    expect((await ui.find({ type: 'Text', text: /^late-mod/ }))?.text).toMatch(/ on$/)
    await ui.unmount()
  },
)

test("the engine's failure notice becomes that mod's last error", async ($, on) => {
  world(on)
  await start($)
  await $.session.append({
    message: {
      type: 'system',
      name: 'informational',
      content: [{ type: 'text', text: 'fleet-gauge: ui.render hook skipped: returned the wrong shape' }],
    },
    door: 'notice',
    origin: { kind: 'engine' },
    uuid: 'row-1',
  } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await ui.find({ type: 'Text', text: /Last error: ui\.render hook skipped: returned the wrong shape/ })).toBeDefined()
  await ui.unmount()

  const glance = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget' } } as never)
  expect((await glance.find({ type: 'Text' }))?.text).toMatch(/1 with an error/)
  await glance.unmount()
})

test('failure lines are read by rule, and a listing never undoes a seen state', () => {
  expect(parseFailure('fleet-gauge: tool.call hook skipped: threw TypeError')).toEqual({
    name: 'fleet-gauge',
    text: 'tool.call hook skipped: threw TypeError',
  })
  expect(parseFailure('model-routing@inline: module did not load: SyntaxError')?.name).toBe('model-routing')
  expect(parseFailure('Compacted: kept 12 messages')).toBeUndefined()
  expect(parseFailure('note: all good')).toBeUndefined()

  const seen = merge(undefined, { name: 'x', status: 'off', from: 'x@inline' })
  expect(merge(seen, { name: 'x', status: 'listed', from: 'CLAUDE_CODE_PLUGIN_DIRS', description: 'd' })).toMatchObject({
    status: 'off',
    from: 'x@inline',
    description: 'd',
  })
})
