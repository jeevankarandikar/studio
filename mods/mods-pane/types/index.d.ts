// How the pane knows a mod's state:
// on: the pane saw it join this session (plugin.register allowed it), or it is the pane itself
// off: a plugin.register judge refused it, or settings set it to false
// listed: named in CLAUDE_CODE_PLUGIN_DIRS or enabled in settings, but it loaded before the pane could see it
export type ModStatus = 'on' | 'off' | 'listed'

export type ModError = { text: string; at: number }

export type ModRow = {
  name: string
  status: ModStatus
  description?: string
  version?: string
  root?: string
  from: string
  lastError?: ModError
}

declare module 'claude-code' {
  interface PluginState {
    'mods-pane': { mods: Record<string, ModRow> }
  }
}
