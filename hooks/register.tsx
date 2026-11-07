import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Summary, View, ModelRow } from '../types'

const PANE = 'door-flow'
const TITLE = 'Путь двери'
const SERVER = 'MSI'
const FILE = '/home/anton/door-flow/out/summary.json'
const REFRESH_MS = 120_000

const view = atom({ plugin: 'door-flow', key: 'view' } as const, { summary: null, error: null, fetchedAt: null, open: null } as View, {
  shape: 'view-1',
})

function textOf(res: { content: { type: string; text?: string }[] }): string {
  return res.content.map(b => (b.type === 'text' ? b.text ?? '' : '')).join('')
}

function stdoutOf(raw: string): string {
  let s = raw
  try {
    const j = JSON.parse(raw)
    if (j && typeof j.result === 'string') s = j.result
  } catch {}
  const a = s.indexOf('--- stdout\n')
  const b = s.lastIndexOf('\n--- stderr')
  if (a >= 0) return s.slice(a + 11, b > a ? b : undefined)
  return s
}

async function refresh($: any) {
  try {
    const local = await $.fs.read(FILE).catch(() => null)
    if (typeof local === 'string' && local.trim().startsWith('{')) {
      const summary = JSON.parse(local) as Summary
      await update($, view, v => ({ ...v, summary, error: null, fetchedAt: Date.now() }))
      return
    }
    const res = await $.mcp.call(SERVER, 'bash', { command: `cat ${FILE}`, timeout: 30 })
    const out = stdoutOf(textOf(res)).trim()
    if (res.isError || !out.startsWith('{')) {
      await update($, view, v => ({ ...v, error: out ? out.slice(0, 200) : 'нет файла summary.json', fetchedAt: Date.now() }))
      return
    }
    const summary = JSON.parse(out) as Summary
    await update($, view, v => ({ ...v, summary, error: null, fetchedAt: Date.now() }))
  } catch (err) {
    await update($, view, v => ({ ...v, error: String(err).slice(0, 200), fetchedAt: Date.now() }))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'door', description: 'Открыть панель «Путь двери» и обновить её' })
    void $.ui.open({ id: PANE, title: TITLE })
    void refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))
    return next(e)
  })

  on('command.run', { command: 'door' }, async $ => {
    const opened: any = await $.ui.open({ id: PANE, title: TITLE })
    await refresh($)
    return {
      text: opened?.isPlaced
        ? 'Панель «Путь двери» открыта и обновлена.'
        : `Панель не показана этим приложением: ${opened?.reason ?? 'причина не сообщена'}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const v = await read($, view)
    const s = v.summary
    const time = (ms?: number | null) => (ms == null ? '' : ms < 1000 ? `${Math.round(ms)} мс` : `${(ms / 1000).toFixed(1)} с`)
    const mark = (st: string) => (st === 'ok' ? '✓' : st === 'hole' ? '✗' : '·')
    const color = (st: string) => (st === 'ok' ? 'green' : st === 'hole' ? 'red' : 'gray')

    const chain = (m: ModelRow) => {
      const parts: any[] = []
      m.steps.forEach((st, i) => {
        if (i > 0) {
          const prev = m.steps[i - 1]
          const l = m.links.find(x => x.from === prev.k && x.to === st.k)
          parts.push(<Text color={l?.kind === 'nolink' ? 'red' : 'gray'}>{l?.kind === 'nolink' ? ' ⇢ ' : ' → '}</Text>)
        }
        parts.push(<Text color={color(st.status)}>{st.k}{mark(st.status)}</Text>)
      })
      return parts
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Button key="refresh" label="Обновить" onPress={() => void refresh($)} />
          <Text dimColor>
            {s?.commit ? `версия ${s.commit.slice(0, 7)}` : ''}
            {v.fetchedAt ? ` · загружено ${new Date(v.fetchedAt).toLocaleTimeString('ru-RU')}` : ' · загрузка…'}
          </Text>
        </Box>
        <Text dimColor>✓ доказано · ✗ дыра · · шага нет · → связано · ⇢ не связано</Text>
        {v.error && <Text color="red">Ошибка: {v.error}</Text>}
        {s?.models.map(m => (
          <Box key={m.name} flexDirection="column">
            <Button key={'m-' + m.name} plain onPress={() => void update($, view, x => ({ ...x, open: x.open === m.name ? null : m.name }))}>
              <Text bold>{m.neg ? '[тест] ' : ''}{m.name}</Text>
              <Text color={m.verdict === 'принята' ? 'green' : 'yellow'}> {m.verdict}</Text>
              <Text dimColor> {time(m.totalMs)}</Text>
            </Button>
            <Box flexDirection="row">{chain(m)}</Box>
            {v.open === m.name && (
              <Box flexDirection="column" paddingLeft={2}>
                {m.steps.map(st => (
                  <Text key={st.k} color={color(st.status)}>
                    {st.k} {st.name} — {st.status === 'ok' ? 'доказано' : st.status === 'hole' ? 'дыра' : 'шага нет'}
                    {st.autoproof === true ? ' (autoproof)' : ''} {time(st.timeMs)}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
