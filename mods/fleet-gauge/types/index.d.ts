export type AgentRow = {
  label: string
  calls: number
  lastAt: number
  isDone: boolean
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// What the engine's last measurement said. A field is absent when the engine
// gave no figure for it: the mod never fills one in.
export type Gauge = {
  tokens?: number
  window: number
  percent?: number
  limits: Limit[]
  costUsd?: number
  at?: number
}

// The engine's own auto-compaction, read from $.session.usage's breakdown.
export type EngineCompact = { isOn: boolean; threshold?: number } | null

// Where the compact suggestion and the optional auto-compaction stand.
export type CompactState = {
  hasSuggested: boolean
  isPending: boolean
  last?: string
}

declare module 'claude-code' {
  interface PluginState {
    'fleet-gauge': {
      agents: Record<string, AgentRow>
      gauge: Gauge | null
      engine: EngineCompact
      compact: CompactState
    }
  }
}
