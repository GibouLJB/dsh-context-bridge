import { createMigration } from './migration.mjs'
import { InputError } from './project.mjs'
import { basename } from 'node:path'

export const name = 'dsh-context-bridge'
export const inject = ['connection', 'workspaceRegistry', 'sessionController']

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export function apply(ctx) {
  const migration = createMigration(() => ctx.get('chatImport'), {
    async prepare(path, sessionId) {
      const registry = ctx.workspaceRegistry
      const workspace = await registry.resolveByPath(path) ?? await registry.create(path)
      const archived = new Set(registry.archivedSessionIds)
      const existing = workspace.sessionIds.find((id) => (id === sessionId || id.startsWith(`${sessionId}-`)) && !archived.has(id))
      if (existing) return existing
      let candidate = sessionId
      for (let copy = 1; archived.has(candidate); copy++) candidate = `${sessionId}-${copy}`
      const session = await ctx.sessionController.create({ workspaceId: workspace.id, sessionId: candidate })
      await ctx.sessionController.rename({ sessionId: session.sessionId, title: `${basename(path)} · 项目交接` })
      return session.sessionId
    },
    async includes(path, id) {
      return (await ctx.workspaceRegistry.resolveByPath(path))?.sessionIds.includes(id) === true
    },
  })
  ctx.connection.fetch.register({
    path: '/api/dsh-context-bridge', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      try {
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({ error: '请求需要 JSON。' }, 415)
        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '无效请求。' }, 400)
        if (body.action === 'scan') return json(await migration.scan(body, request.signal))
        if (body.action === 'preview') return json(await migration.preview(body, request.signal))
        if (body.action === 'apply') return json(await migration.apply(body))
        return json({ error: '未知操作。' }, 400)
      } catch (error) {
        return json({ error: error.message || '迁移失败。', field: error instanceof InputError ? error.field : undefined }, error instanceof InputError ? 400 : 500)
      }
    },
  })
}
