export type Step = { k: string; name: string; status: 'ok' | 'hole' | 'missing'; timeMs?: number | null; autoproof?: boolean | null }
export type Link = { from: string; to: string; kind: 'link' | 'nolink' }
export type ModelRow = { name: string; verdict: string; totalMs?: number | null; neg?: boolean; steps: Step[]; links: Link[] }
export type Summary = { commit?: string; generatedAt?: string; machine?: string; models: ModelRow[] }
export type View = { summary: Summary | null; error: string | null; fetchedAt: number | null; open: string | null }

declare module 'claude-code' {
  interface PluginState {
    'door-flow': { view: Shaped<View> }
  }
}
