import { expect, mock, test } from 'claude-code/testing'
import { problems, settingsFrom } from './register'

// Samskara's settings, the values its settings.json env block holds.
const SAMSKARA = {
  RUN_GUARD_CHECK: String.raw`\bpython3?(?:\s+-\S+)*\s+(?:\S*healthcheck\.py\b|\S*golden\.py\s+run\b|\S*scripts\/check\.py\b|\S*test_fresh_home\.py\b|\S+\.py\s+selftest\b|-m\s+[\w.]+\s+selftest\b)`,
  RUN_GUARD_HOME_VAR: 'SAMSKARA_HOME',
  RUN_GUARD_DATA_HOME: '~/.samskara',
  RUN_GUARD_EXEMPT: String.raw`\b(?:ship\.py|release\.sh)\b`,
  RUN_GUARD_HOME_HINT:
    'Give it a throwaway home with data/exports and vault folders and a .env holding SAMSKARA_NO_LOCAL_EXTRACT=1, ' +
    'and run it as env -u SAMSKARA_DB -u SAMSKARA_DATA -u SAMSKARA_VAULT SAMSKARA_HOME="$H" SAMSKARA_NO_LOCAL_EXTRACT=1 <command>',
  RUN_GUARD_LONG: String.raw`\bpython3?(?:\s+-\S+)*\s+\S*healthcheck\.py\b(?![^|;&]*--fast)`,
  RUN_GUARD_LONG_HINT: 'add --fast',
  RUN_GUARD_REPO: '/samskara',
  HOME: '/home/example',
}

const S = settingsFrom(SAMSKARA)
const NONE = settingsFrom({})
const CHECKOUT = '/home/example/Developer/GitHub/samskara/.claude/worktrees/w1'
const STUDIO = '/home/example/Developer/GitHub/studio'

test('a selftest with no home is held once, then runs as written', async ($, on) => {
  mock.env(on, SAMSKARA)
  on('session.cwd', () => ({ value: CHECKOUT }))
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  const call = { tool: 'Bash' as const, command: 'uv run python3 app/server.py selftest' }
  const first = await $.tool.call(call)
  expect(first.deny ?? '').toMatch(/no SAMSKARA_HOME/)
  expect(first.deny ?? '').toMatch(/SAMSKARA_NO_LOCAL_EXTRACT=1/)
  expect(ran).toBe(0)
  await $.tool.call(call)
  expect(ran).toBe(1)
})

test('a check with its own home, and the release scripts, pass at once', async ($, on) => {
  mock.env(on, SAMSKARA)
  on('session.cwd', () => ({ value: CHECKOUT }))
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  await $.tool.call({ tool: 'Bash', command: 'SAMSKARA_HOME=$H uv run python3 scripts/healthcheck.py --fast' })
  await $.tool.call({ tool: 'Bash', command: 'bash scripts/release.sh selftest' })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(ran).toBe(3)
})

test('with no settings a check runs at once, and claude -p is still held', async ($, on) => {
  mock.env(on, {})
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  await $.tool.call({ tool: 'Bash', command: 'uv run python3 app/server.py selftest' })
  await $.tool.call({ tool: 'Bash', command: 'uv run python3 scripts/healthcheck.py' })
  expect(ran).toBe(2)
  const held = await $.tool.call({ tool: 'Bash', command: 'claude -p "hi"' })
  expect(held.deny ?? '').toMatch(/ANTHROPIC_API_KEY/)
  expect(ran).toBe(2)
})

test('a setting that is not a valid pattern turns its rule off and says so once', async ($, on) => {
  mock.env(on, { ...SAMSKARA, RUN_GUARD_CHECK: '(' })
  on('session.cwd', () => ({ value: CHECKOUT }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  await $.tool.call({ tool: 'Bash', command: 'uv run python3 app/server.py selftest' })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(ran).toBe(2)
  expect(toasts).toEqual(['run-guard: RUN_GUARD_CHECK is not a valid regular expression, so that rule is off'])
  expect(settingsFrom({ RUN_GUARD_CHECK: '(' }).errors).toEqual(['RUN_GUARD_CHECK is not a valid regular expression'])
})

test('the rules read the command text', () => {
  expect(problems('SAMSKARA_HOME=$H uv run python3 scripts/healthcheck.py', false, S, CHECKOUT)).toHaveLength(1)
  expect(problems('SAMSKARA_HOME=$H uv run python3 scripts/healthcheck.py', true, S, CHECKOUT)).toHaveLength(0)
  expect(problems('claude -p "hi"', false, S, CHECKOUT)[0]).toMatch(/ANTHROPIC_API_KEY/)
  expect(problems('env -u ANTHROPIC_API_KEY claude -p "hi"', false, S, CHECKOUT)).toHaveLength(0)
  expect(problems('grep -n heif scripts/healthcheck.py', false, S, CHECKOUT)).toHaveLength(0)
  expect(problems('sed -n 1,5p app/server.py selftest', false, S, CHECKOUT)).toHaveLength(0)
  expect(problems('uv run python3 -m samskara.heif selftest', false, S, CHECKOUT)[0]).toMatch(/no SAMSKARA_HOME/)
  expect(problems('.venv/bin/python3 tools/build_attachment_text.py selftest', false, S, CHECKOUT)).toHaveLength(1)
})

test('the long run names its hint, and needs RUN_GUARD_LONG', () => {
  expect(problems('SAMSKARA_HOME=$H uv run python3 scripts/healthcheck.py', false, S, CHECKOUT)[0]).toMatch(/for hours.*or add --fast/)
  expect(problems('SAMSKARA_HOME=$H uv run python3 scripts/healthcheck.py', false, NONE)).toHaveLength(0)
})

test('a check pointed at the real data home is held, in any spelling of it', () => {
  for (const home of ['~/.samskara', '"$HOME/.samskara"', '${HOME}/.samskara/', '/home/example/.samskara', "'~/.samskara'"]) {
    expect(problems(`SAMSKARA_HOME=${home} uv run python3 scripts/check.py`, false, S, CHECKOUT)[0]).toMatch(/set to the real data at ~\/\.samskara/)
  }
  expect(problems('SAMSKARA_HOME=~/.samskara-bench uv run python3 scripts/check.py', false, S, CHECKOUT)).toHaveLength(0)
  const noPaths = settingsFrom({ ...SAMSKARA, RUN_GUARD_DATA_HOME: '' })
  expect(problems('SAMSKARA_HOME=~/.samskara uv run python3 scripts/check.py', false, noPaths, CHECKOUT)).toHaveLength(0)
})

test('the home rule needs both the check pattern and the home variable', () => {
  const noVar = settingsFrom({ ...SAMSKARA, RUN_GUARD_HOME_VAR: '' })
  expect(problems('uv run python3 app/server.py selftest', false, noVar, CHECKOUT)).toHaveLength(0)
  expect(problems('uv run python3 app/server.py selftest', false, NONE)).toHaveLength(0)
  const plain = settingsFrom({ RUN_GUARD_CHECK: String.raw`\bnpm test\b`, RUN_GUARD_HOME_VAR: 'APP_HOME' })
  expect(problems('npm test', false, plain)[0]).toMatch(/no APP_HOME.*APP_HOME="\$H" <command>/)
  expect(problems('APP_HOME=/tmp/x npm test', false, plain)).toHaveLength(0)
})

test('claude -p named inside a message or heredoc is not a run; one at a command start is', () => {
  expect(problems('git commit -m "the guard lets a claude -p with a cleared key pass"', false, NONE)).toHaveLength(0)
  expect(problems("python3 - <<'EOF'\nprint('use claude -p here')\nEOF", false, NONE)).toHaveLength(0)
  expect(problems('grep -n "claude -p" README.md', false, NONE)).toHaveLength(0)
  expect(problems('cd /tmp && claude -p "hi"', false, NONE)).toHaveLength(1)
  expect(problems("bash -c 'claude -p hi'", false, NONE)).toHaveLength(1)
  expect(problems('timeout 60 claude --print hi', false, NONE)).toHaveLength(1)
  expect(problems('FOO=1 ~/.local/bin/claude --model sonnet -p hi', false, NONE)).toHaveLength(1)
  expect(problems('out=$(claude -p hi)', false, NONE)).toHaveLength(1)
})

test('a claude -p whose key is cleared by unset or an empty value passes', () => {
  expect(problems('unset ANTHROPIC_API_KEY; claude -p "hi"', false, NONE)).toHaveLength(0)
  expect(problems('unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY && claude -p "hi"', false, NONE)).toHaveLength(0)
  expect(problems('ANTHROPIC_API_KEY= claude -p "hi"', false, NONE)).toHaveLength(0)
  expect(problems("ANTHROPIC_API_KEY='' claude --print hi", false, NONE)).toHaveLength(0)
  expect(problems('ANTHROPIC_API_KEY=sk-x claude -p "hi"', false, NONE)[0]).toMatch(/ANTHROPIC_API_KEY/)
  expect(problems('echo $ANTHROPIC_API_KEY; claude -p "hi"', false, NONE)[0]).toMatch(/ANTHROPIC_API_KEY/)
})

test('with RUN_GUARD_REPO a check in another repository runs at once', async ($, on) => {
  mock.env(on, SAMSKARA)
  on('session.cwd', () => ({ value: STUDIO }))
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  await $.tool.call({ tool: 'Bash', command: 'python3 -B scripts/check.py' })
  await $.tool.call({ tool: 'Bash', command: 'python3 scripts/healthcheck.py' })
  expect(ran).toBe(2)
  const held = await $.tool.call({ tool: 'Bash', command: 'claude -p "hi"' })
  expect(held.deny ?? '').toMatch(/ANTHROPIC_API_KEY/)
  expect(ran).toBe(2)
})

test('with RUN_GUARD_REPO a check in the named repository is still held', async ($, on) => {
  mock.env(on, SAMSKARA)
  on('session.cwd', () => ({ value: CHECKOUT }))
  let ran = 0
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  const held = await $.tool.call({ tool: 'Bash', command: 'python3 -B scripts/check.py' })
  expect(held.deny ?? '').toMatch(/no SAMSKARA_HOME/)
  expect(ran).toBe(0)
  expect(problems('python3 -B scripts/check.py', false, S, STUDIO)).toHaveLength(0)
  expect(problems('python3 scripts/healthcheck.py', false, S, STUDIO)).toHaveLength(0)
  expect(problems('python3 scripts/healthcheck.py', false, S, CHECKOUT)).toHaveLength(2)
  const two = settingsFrom({ ...SAMSKARA, RUN_GUARD_REPO: '/samskara:/samskara-app' })
  expect(problems('python3 -B scripts/check.py', false, two, '/srv/samskara-app')).toHaveLength(1)
  const any = settingsFrom({ ...SAMSKARA, RUN_GUARD_REPO: '' })
  expect(problems('python3 -B scripts/check.py', false, any, STUDIO)).toHaveLength(1)
})
