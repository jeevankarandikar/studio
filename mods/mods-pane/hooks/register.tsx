import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ModRow, ModStatus } from '../types'

const PANE = 'mods'
const TITLE = 'Mods'

const mods = atom({ plugin: 'mods-pane', key: 'mods' } as const, {})

// A notice the engine writes when a mod's hook or module fails, such as
// "fleet-gauge: ui.render hook skipped: returned the wrong shape".
const FAILURE = /^([A-Za-z0-9][\w.@-]*): (.*\b(?:skipped|did not load|does not load|failed|refused|threw|error)\b.*)$/i

export const parseFailure = (text: string): { name: string; text: string } | undefined => {
  const line = text.split('\n').find(l => FAILURE.test(l.trim()))
  const m = line === undefined ? null : FAILURE.exec(line.trim())
  if (m === null || m[1] === undefined || m[2] === undefined) return undefined
  return { name: m[1].replace(/@.*$/, ''), text: m[2] }
}

const RANK: Record<ModStatus, number> = { on: 0, listed: 1, off: 2 }

// A seen join or refusal is firmer than a listing, so a listing never overwrites it.
export const merge = (old: ModRow | undefined, patch: Partial<ModRow> & { name: string }): ModRow => {
  const base: ModRow = old ?? { name: patch.name, status: 'listed', from: patch.from ?? 'settings' }
  const keepStatus = old !== undefined && old.status !== 'listed' && patch.status === 'listed'
  return {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    status: keepStatus ? base.status : (patch.status ?? base.status),
    from: keepStatus ? base.from : (patch.from ?? base.from),
  }
}

export const ordered = (rows: Record<string, ModRow>): ModRow[] =>
  Object.values(rows).sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name))

export const statusText = (row: ModRow): string =>
  row.status === 'on' ? 'on' : row.status === 'off' ? 'off' : 'listed, load not seen'

const expand = (dir: string, home: string | undefined): string =>
  dir.startsWith('~/') && home !== undefined ? `${home}${dir.slice(1)}` : dir

async function manifest($: EngineInterface, root: string): Promise<{ name?: string; description?: string; version?: string }> {
  try {
    const parsed: unknown = JSON.parse(await $.fs.read(`${root}/.claude-plugin/plugin.json`))
    if (typeof parsed !== 'object' || parsed === null) return {}
    const m = parsed as Record<string, unknown>
    return {
      name: typeof m.name === 'string' ? m.name : undefined,
      description: typeof m.description === 'string' ? m.description : undefined,
      version: typeof m.version === 'string' ? m.version : undefined,
    }
  } catch {
    return {}
  }
}

async function survey($: EngineInterface): Promise<void> {
  const home = await $.env.get('HOME')
  const self = await manifest($, $.plugin.root)
  await update($, mods, rows => ({
    ...rows,
    [$.plugin.name]: merge(rows[$.plugin.name], {
      name: $.plugin.name,
      status: 'on',
      from: 'this pane',
      root: $.plugin.root,
      description: self.description,
      version: self.version,
    }),
  }))

  const dirs = ((await $.env.get('CLAUDE_CODE_PLUGIN_DIRS')) ?? '').split(':').filter(d => d.trim() !== '')
  for (const dir of dirs) {
    const root = expand(dir.trim(), home)
    const m = await manifest($, root)
    const name = m.name ?? root.split('/').filter(Boolean).at(-1) ?? root
    await update($, mods, rows => ({
      ...rows,
      [name]: merge(rows[name], {
        name,
        status: 'listed',
        from: 'CLAUDE_CODE_PLUGIN_DIRS',
        root,
        description: m.description ?? (Object.keys(m).length === 0 ? 'No plugin.json found in this folder.' : undefined),
        version: m.version,
      }),
    }))
  }

  const enabled = await $.settings.read({ key: 'enabledPlugins' }).catch(() => undefined)
  if (typeof enabled === 'object' && enabled !== null) {
    for (const [id, value] of Object.entries(enabled as Record<string, unknown>)) {
      const name = id.replace(/@.*$/, '')
      const market = id.includes('@') ? id.slice(id.indexOf('@') + 1) : undefined
      const m = market === undefined || home === undefined
        ? {}
        : await manifest($, `${home}/.claude/plugins/marketplaces/${market}/plugins/${name}`)
      await update($, mods, rows => ({
        ...rows,
        [name]: merge(rows[name], {
          name,
          status: value === false ? 'off' : 'listed',
          from: market === undefined ? 'settings' : `settings, from ${market}`,
          description: m.description,
          version: m.version,
        }),
      }))
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mod-list',
      description: 'Open a pane listing each mod, whether it is on, what it does, and its last error',
    })
    await survey($)

    return next(e)
  })

  // Every hooks module that loads after this one passes here, on reloads too.
  on('plugin.register', async ($, e, next) => {
    const r = await next(e)
    const m = await manifest($, e.root)
    const refused = 'refuse' in r && r.refuse !== undefined
    const at = await $.clock.now()
    await update($, mods, rows => ({
      ...rows,
      [e.name]: merge(rows[e.name], {
        name: e.name,
        status: refused ? 'off' : 'on',
        from: e.provenance,
        root: e.root,
        version: e.version ?? m.version,
        description: m.description,
        lastError: refused ? { text: `refused at load: ${String(r.refuse)}`, at } : rows[e.name]?.lastError,
      }),
    }))

    return r
  })

  // The engine notes a failed hook or module as a line in the transcript.
  on('session.append', async ($, e, next) => {
    if (e.message.type === 'system' || e.door === 'notice') {
      const text = (e.message.content ?? [])
        .map(block => ('text' in block && typeof block.text === 'string' ? block.text : ''))
        .join('\n')
      const failure = parseFailure(text)
      if (failure !== undefined) {
        const at = await $.clock.now()
        await update($, mods, rows =>
          rows[failure.name] === undefined
            ? rows
            : { ...rows, [failure.name]: { ...rows[failure.name]!, lastError: { text: failure.text, at } } },
        )
      }
    }

    return next(e)
  })

  on('ui.fault', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, mods, rows => ({
      ...rows,
      [$.plugin.name]: merge(rows[$.plugin.name], { name: $.plugin.name, lastError: { text: `pane drawing failed: ${e.reason}`, at } }),
    }))

    return next(e)
  })

  on('command.run', { command: 'mod-list' }, async $ => {
    await survey($)
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
    if (isPlaced) return { text: 'Mods pane opened.' }
    const rows = ordered(await read($, mods))

    return {
      text: rows
        .map(r => `${r.name} (${statusText(r)}): ${r.description ?? 'no description'}${r.lastError ? `\n  last error: ${r.lastError.text}` : ''}`)
        .join('\n'),
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const rows = ordered(await read($, mods))
    const errors = rows.filter(r => r.lastError !== undefined).length
    const mine = rows.filter(r => r.root !== undefined)
    const installed = rows.filter(r => r.root === undefined)

    if (e.props.placement === 'widget') {
      return (
        <Text color={errors > 0 ? 'red' : undefined}>
          {rows.filter(r => r.status === 'on').length} on, {errors === 0 ? 'no errors' : `${errors} with an error`}
        </Text>
      )
    }

    const block = (r: ModRow) => (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>
          {r.name}
          {r.version === undefined ? '' : ` ${r.version}`}{'  '}
          <Text color={r.status === 'on' ? 'green' : r.status === 'off' ? 'red' : 'yellow'}>{statusText(r)}</Text>
        </Text>
        {r.description !== undefined && <Text dimColor>{r.description}</Text>}
        <Text color={r.lastError ? 'red' : undefined} dimColor={!r.lastError}>
          {r.lastError ? `Last error: ${r.lastError.text}` : 'No error seen this session'}
        </Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {mine.length === 0 && installed.length === 0 && <Text dimColor>No mods found.</Text>}
        {mine.map(block)}
        {installed.length > 0 && <Text bold>Installed plugins</Text>}
        {installed.map(r => (
          <Text>
            {r.name}{'  '}
            <Text color={r.status === 'off' ? 'red' : undefined} dimColor={r.status !== 'off'}>
              {r.status === 'off' ? 'off' : 'on in settings'}
            </Text>
            {r.lastError ? <Text color="red">{`  last error: ${r.lastError.text}`}</Text> : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
