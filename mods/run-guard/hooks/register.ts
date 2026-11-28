import type { Register } from 'claude-code'

export type Env = Readonly<Record<string, string | undefined>>

export type Settings = {
  check?: RegExp
  homeVar?: string
  dataHomes: readonly string[]
  exempt?: RegExp
  homeHint?: string
  long?: RegExp
  longHint?: string
  repos: readonly string[]
  home?: string
  errors: readonly string[]
}

// claude -p only where a command starts: the line's start, after ; & | ( $( or a
// newline or a backtick, or the first word of a bash -c '...' string, past env, nohup, time,
// timeout and VAR=value prefixes. A commit message or heredoc that names it mid-text is not a run.
const PREFIX = String.raw`(?:(?:env(?:\s+-\S+(?:\s+[A-Z_][A-Z0-9_]*)?)*|nohup|time|exec|command|timeout\s+\S+)\s+|[A-Za-z_]\w*=\S*\s+)*`
const CLAUDE_P = new RegExp(String.raw`(?:^|[;&|(\n]|\$\(|\x60|-c\s+["'])\s*` + PREFIX + String.raw`(?:\S*\/)?claude\s+(?:--?[\w-]+(?:\s+[^-\s]\S*)?\s+)*?(?:-p|--print)\b`)
// The key is gone when env -u drops it, unset clears it, or it is set empty for the command.
const KEY_DROPPED = /-u\s+ANTHROPIC_API_KEY\b|\bunset\s+(?:-v\s+)?(?:\w+\s+)*ANTHROPIC_API_KEY\b|(?:^|[\s;&|(])ANTHROPIC_API_KEY=(?:''|"")?(?=\s|$)/

const text = (v: string | undefined): string | undefined => {
  const t = v?.trim()
  return t === undefined || t === '' ? undefined : t
}

export const settingsFrom = (env: Env): Settings => {
  const errors: string[] = []
  const pattern = (name: string): RegExp | undefined => {
    const src = text(env[name])
    if (src === undefined) return undefined
    try {
      return new RegExp(src)
    } catch {
      errors.push(`${name} is not a valid regular expression`)
      return undefined
    }
  }
  const homeVar = text(env.RUN_GUARD_HOME_VAR)
  if (homeVar !== undefined && !/^[A-Za-z_]\w*$/.test(homeVar)) errors.push('RUN_GUARD_HOME_VAR is not a variable name')
  return {
    check: pattern('RUN_GUARD_CHECK'),
    homeVar: homeVar !== undefined && /^[A-Za-z_]\w*$/.test(homeVar) ? homeVar : undefined,
    dataHomes: (env.RUN_GUARD_DATA_HOME ?? '').split(':').map(p => p.trim()).filter(p => p !== ''),
    exempt: pattern('RUN_GUARD_EXEMPT'),
    homeHint: text(env.RUN_GUARD_HOME_HINT),
    long: pattern('RUN_GUARD_LONG'),
    longHint: text(env.RUN_GUARD_LONG_HINT),
    repos: (env.RUN_GUARD_REPO ?? '').split(':').map(p => p.trim()).filter(p => p !== ''),
    home: text(env.HOME),
    errors,
  }
}

const unquote = (v: string): string => v.replace(/^(["'])(.*)\1$/, '$2')

// ~, $HOME and ${HOME} name the same folder, and a trailing slash changes nothing.
const sameFolder = (path: string, home: string | undefined): string => {
  let p = unquote(path).replace(/^(?:\$HOME|\$\{HOME\})(?=\/|$)/, '~')
  if (home !== undefined && (p === home || p.startsWith(`${home}/`))) p = `~${p.slice(home.length)}`
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

const homeProblem = (command: string, s: Settings): string | undefined => {
  if (s.check === undefined || s.homeVar === undefined) return undefined
  if (!s.check.test(command) || s.exempt?.test(command) === true) return undefined
  const where = s.dataHomes.length > 0 ? ` at ${s.dataHomes.join(' or ')}` : ''
  const hint = s.homeHint ?? `Give it a throwaway home and run it as ${s.homeVar}="$H" <command>`
  const values = [...command.matchAll(new RegExp(String.raw`\b${s.homeVar}=("[^"]*"|'[^']*'|\S*)`, 'g'))].map(m => m[1] ?? '')
  if (values.length === 0) {
    return `it runs a check with no ${s.homeVar}, so the check reads and may write the real data${where}. ${hint}`
  }
  const real = s.dataHomes.map(p => sameFolder(p, s.home))
  const hit = values.find(v => real.includes(sameFolder(v, s.home)))
  if (hit !== undefined) {
    return `it runs a check with ${s.homeVar} set to the real data${where}. ${hint}`
  }
  return undefined
}

export const inRepo = (cwd: string, s: Settings): boolean => s.repos.length === 0 || s.repos.some(r => cwd.includes(r))

export const problems = (command: string, background: boolean, s: Settings, cwd = ''): string[] => {
  const out: string[] = []
  const here = inRepo(cwd, s)
  const home = here ? homeProblem(command, s) : undefined
  if (home !== undefined) out.push(home)
  if (here && s.long?.test(command) === true && !background) {
    out.push(`it runs for hours in the foreground; run it with run_in_background${s.longHint === undefined ? '' : `, or ${s.longHint}`}`)
  }
  if (CLAUDE_P.test(command) && !KEY_DROPPED.test(command)) {
    out.push(
      'it runs claude -p, which inherits the ANTHROPIC_API_KEY the desktop app passes down and fails with Invalid API key; ' +
        'prefix it with env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN',
    )
  }
  return out
}

export const register: Register = on => {
  const asked = new Set<string>()
  let warned = false
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const s = settingsFrom({
      RUN_GUARD_CHECK: await $.env.get('RUN_GUARD_CHECK'),
      RUN_GUARD_HOME_VAR: await $.env.get('RUN_GUARD_HOME_VAR'),
      RUN_GUARD_DATA_HOME: await $.env.get('RUN_GUARD_DATA_HOME'),
      RUN_GUARD_EXEMPT: await $.env.get('RUN_GUARD_EXEMPT'),
      RUN_GUARD_HOME_HINT: await $.env.get('RUN_GUARD_HOME_HINT'),
      RUN_GUARD_LONG: await $.env.get('RUN_GUARD_LONG'),
      RUN_GUARD_LONG_HINT: await $.env.get('RUN_GUARD_LONG_HINT'),
      RUN_GUARD_REPO: await $.env.get('RUN_GUARD_REPO'),
      HOME: await $.env.get('HOME'),
    })
    if (s.errors.length > 0 && !warned) {
      warned = true
      $.ui.toast(`run-guard: ${s.errors.join('; ')}, so that rule is off`)
    }
    const cwd = s.repos.length === 0 ? '' : await $.session.cwd().catch(() => '')
    const found = problems(e.command ?? '', e.run_in_background === true, s, cwd)
    if (found.length === 0) return next(e)
    const k = `${e.command}\u0000${e.run_in_background === true}`
    if (asked.has(k)) {
      asked.delete(k)
      return next(e)
    }
    asked.add(k)
    return {
      deny: `run-guard: this command was held once because ${found.join('; and ')}. Fix it and send the new command, or send the same command again unchanged to run it as written.`,
    }
  }).catch(($, e, next) => next(e))
}
