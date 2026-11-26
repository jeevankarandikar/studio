import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { TABLE } from './register'

const SESSION = 'mcp__ccd_session__start_session'

test('an agent with no model is asked once, and the same call again goes through', async ($, on) => {
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })

  const first = await $.tool.call({ tool: 'Agent', description: 'find files', prompt: 'list the scripts' })
  expect(first.deny ?? first.text ?? '').toMatch(/names no model/)
  expect(ran).toBe(0)

  const again = await $.tool.call({ tool: 'Agent', description: 'find files', prompt: 'list the scripts' })
  expect(again.isError).toBeUndefined()
  expect(ran).toBe(1)
})

test('an agent that names a model, and a fork, pass at once', async ($, on) => {
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })

  await $.tool.call({ tool: 'Agent', description: 'read docs', prompt: 'p', model: 'sonnet' })
  await $.tool.call({ tool: 'Agent', description: 'side task', prompt: 'p', subagent_type: 'fork' })
  expect(ran).toBe(2)
})

test('a fresh session with no model is asked; an offer and a proposal start are not', async ($, on) => {
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })

  const fresh = await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 't', prompt: 'p', background: 'b' })
  expect(fresh.deny ?? fresh.text ?? '').toMatch(/names no model/)
  await $.tool.call({ tool: SESSION, initiation: 'offer', title: 't' })
  await $.tool.call({ tool: SESSION, proposal_id: 'task_1' })
  await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 't', prompt: 'p', context: 'fork' })
  expect(ran).toBe(3)
})

test('the routing table is added to the system prompt', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hello', scope: 'shared' }] }))
  const composed = await $.prompt.compose({
    model: 'claude-opus-5-5',
    promptModel: 'claude-opus-5-5',
    surfaces: ['desktop'],
    tools: ['Agent'],
    outputStyle: null,
    traits: [],
  })
  const table = composed.sections.find(s => s.id === 'model-routing:table')
  expect(table?.text).toMatch(/Fable 5\.2/)
  expect(table?.scope).toBe('session')
})

const passes = (on: On, own = 'claude-opus-5-5') => {
  const seen = { ran: 0 }
  on('session.model', () => ({ value: own }))
  on('tool.call', () => {
    seen.ran += 1
    return { result: {} }
  })
  return seen
}

test('a cloud session and a preset session are not asked for a model', async ($, on) => {
  const seen = passes(on)
  await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 't', prompt: 'p', background: 'b', target: 'cloud' })
  await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 't', prompt: 'p', background: 'b', preset: 'devbox' })
  expect(seen.ran).toBe(2)
})

test('a session given an alias is asked for the full id', async ($, on) => {
  const seen = passes(on)
  const held = await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 'Fix tests', prompt: 'p', background: 'b', model: 'sonnet' })
  expect(held.deny ?? held.text ?? '').toMatch(/full model id, such as claude-sonnet-5-5/)
  await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 'Fix tests', prompt: 'p', background: 'b', model: 'claude-sonnet-5-5' })
  expect(seen.ran).toBe(1)
})

test('a session model above the parent is named as ignored', async ($, on) => {
  const seen = passes(on, 'claude-opus-5-5')
  const held = await $.tool.call({ tool: SESSION, initiation: 'user_asked', title: 'R and D', prompt: 'p', background: 'b', model: 'claude-fable-5-2' })
  expect(held.deny ?? held.text ?? '').toMatch(/ignores a session model above your own/)
  expect(seen.ran).toBe(0)
})

test('haiku on review work and fable on a sweep are held once; fitting picks pass', async ($, on) => {
  const seen = passes(on)
  const review = await $.tool.call({ tool: 'Agent', description: 'Review the auth diff', prompt: 'p', model: 'haiku' })
  expect(review.deny ?? review.text ?? '').toMatch(/opus fits/)
  const sweep = await $.tool.call({ tool: 'Agent', description: 'Find test files', prompt: 'p', model: 'fable' })
  expect(sweep.deny ?? sweep.text ?? '').toMatch(/haiku or sonnet fits/)
  expect(seen.ran).toBe(0)

  await $.tool.call({ tool: 'Agent', description: 'Review the auth diff', prompt: 'p', model: 'haiku' })
  await $.tool.call({ tool: 'Agent', description: 'Find test files', prompt: 'p', model: 'haiku' })
  await $.tool.call({ tool: 'Agent', description: 'Design the pane', prompt: 'p', model: 'fable' })
  await $.tool.call({ tool: 'Agent', description: 'Review the auth diff', prompt: 'p', model: 'opus' })
  expect(seen.ran).toBe(4)
})

test('the table routes all four models by the four things', async () => {
  for (const id of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-2']) {
    expect(TABLE).toContain(id)
  }
  for (const row of ['| Difficulty |', '| Novelty |', '| Volume |', '| A mistake |']) {
    expect(TABLE).toContain(row)
  }
})
