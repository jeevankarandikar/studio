export type Typed = number

declare module 'claude-code' {
  interface PluginState {
    'prompt-guard': { typed: Typed }
  }
}
