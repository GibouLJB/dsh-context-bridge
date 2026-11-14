import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { buildSummary, chatgptEvidence, projectMatch } from './context.mjs'
import { InputError, inspectProject, localPath } from './project.mjs'

import { chatgptExport, maxFileBytes } from './chatgpt-export.mjs'
const maxSelected = 12
const ttl = 20 * 60 * 1000
const hash = (value) => createHash('sha256').update(value).digest('hex')
const keyOf = (session) => hash(JSON.stringify([session.format, session.sourcePath, session.sessionId]))
const formatLabel = { chatgpt: 'ChatGPT', claude: 'Claude Code' }

async function checkField(field, operation) {
  try { return await operation() } catch (error) {
    if (error instanceof InputError) error.field = field
    throw error
  }
}

function list(value, limit, label) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > limit || value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 4096)) {
    throw new InputError(`${label}格式无效，最多可提供 ${limit} 项。`)
  }
  return [...new Set(value.map((item) => item.trim()))]
}

async function readText(path) {
  const info = await stat(path)
  if (!info.isFile() || info.size > maxFileBytes) throw new InputError(`请选择小于 256 MiB 的会话文件：${path}`)
  return readFile(path, 'utf8')
}

const nativeStatuses = new Set(['imported', 'already-imported', 'appended', 'replaced'])
function resultFor(out, session, workspace) {
  const item = out.mode === 'batch' && out.results?.length === 1 ? out.results[0] : out
  if (!item || !nativeStatuses.has(item.status) || !item.sessionId || item.sessionId === 'none') {
    throw new Error(item?.error || item?.reason || `导入器返回 ${item?.status || '无有效会话'}`)
  }
  return {
    key: session.key, title: session.title, status: item.status, sessionId: item.sessionId,
    workspace: item.workspace || out.workspace || workspace,
    groupingWarning: item.ungroupedReason || out.ungroupedReason || '',
  }
}

function remember(map, value, max) {
  const now = Date.now()
  for (const [key, entry] of map) if (entry.expires <= now) map.delete(key)
  if (map.size >= max) map.delete(map.keys().next().value)
  const id = randomUUID()
  map.set(id, { ...value, expires: now + ttl })
  return id
}

function recover(map, id, label) {
  const entry = map.get(id)
  if (!entry || entry.expires <= Date.now()) throw new InputError(`${label}已过期，请重新扫描或预览。`)
  return entry
}

export function createMigration(getImporter, projectHost, stateDir = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-context-bridge')) {
  const scans = new Map()
  const plans = new Map()
  let applying = false
  const importer = () => {
    const service = getImporter()
    if (!service?.scanDiscover || !service?.importPath) throw new InputError('请在同一个 DSH profile 中安装并启用 dsh-chat-import 0.26.6。')
    return service
  }

  async function scan(input, signal) {
    const service = importer()
    const workspace = await checkField('workspace', () => localPath(input.workspace, 'directory', true))
    const keywords = list(input.keywords, 15, '关键词')
    const extraFiles = list(input.files, 30, '补充文件')
    const sources = []
    if (input.chatgptPath) sources.push({ format: 'chatgpt', path: await checkField('chatgptPath', () => localPath(input.chatgptPath, 'file', true)) })
    if (input.includeClaude) sources.push({ format: 'claude', path: input.claudePath ? await checkField('claudePath', async () => {
      const path = await localPath(input.claudePath, undefined, true)
      const info = await stat(path)
      if (!info.isDirectory() && !(info.isFile() && extname(path).toLowerCase() === '.jsonl')) throw new InputError('请选择 Claude Code 日志目录或 .jsonl 文件。')
      return path
    }) : undefined })
    if (sources.length === 0) throw Object.assign(new InputError('请添加 ChatGPT 导出文件或勾选 Claude Code。'), { field: 'chatgptPath' })
    const project = await inspectProject(workspace, extraFiles)
    const warnings = [...project.warnings]
    const sessions = new Map()
    let chatgptFingerprint
    for (const source of sources) {
      signal?.throwIfAborted()
      let exported
      if (source.format === 'chatgpt') {
        exported = await checkField('chatgptPath', () => chatgptExport(source.path, signal))
        chatgptFingerprint = exported.fingerprint
      }
      try {
        const found = exported ? {} : await service.scanDiscover(source, signal)
        for (const item of found.warnings ?? []) warnings.push(`${formatLabel[source.format]} · ${item.target || ''} · ${item.error || '扫描失败'}`)
        const foundRows = [...(found.sessions ?? [])]
        if (exported) {
          for (const [sessionId, conversation] of exported.conversations) {
            foundRows.push({ format: 'chatgpt', sourcePath: source.path, sessionId, title: conversation.title, lastActiveAt: conversation.update_time })
          }
        }
        for (const item of foundRows) {
          if (item.format !== source.format || typeof item.sessionId !== 'string' || typeof item.sourcePath !== 'string') continue
          const metadata = exported?.conversations.get(item.sessionId)
          const names = [metadata?.project_name, metadata?.project?.name, metadata?.project?.title].filter((value) => typeof value === 'string')
          const key = keyOf(item)
          const reason = projectMatch(item, workspace, keywords, names)
          sessions.set(key, { key, format: item.format, sourcePath: item.sourcePath, sessionId: item.sessionId, title: item.title || item.sessionId, lastActiveAt: item.lastActiveAt, reason })
        }
      } catch (error) {
        if (signal?.aborted) throw error
        warnings.push(`${formatLabel[source.format]} · ${error.message}`)
      }
    }
    const rows = [...sessions.values()].sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)) || (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))
    const scanId = remember(scans, { workspace, sessions, project, chatgptFingerprint }, 8)
    return { scanId, workspace, sessions: rows.map(({ sourcePath, ...row }) => row), ...project, warnings }
  }

  async function preview(input, signal) {
    const service = importer()
    const scan = recover(scans, input.scanId, '扫描结果')
    const keys = list(input.keys, maxSelected, '会话选择')
    if (!keys.length || keys.some((key) => !scan.sessions.has(key))) throw new InputError('请从扫描结果中选择 1–12 个会话。')
    let exported
    const selected = []
    for (const key of keys) {
      signal?.throwIfAborted()
      const session = scan.sessions.get(key)
      if (session.format === 'chatgpt') {
        exported ??= await chatgptExport(session.sourcePath, signal)
        if (exported.fingerprint !== scan.chatgptFingerprint) throw new InputError('ChatGPT 导出已变更，请重新扫描。')
        const conversation = exported.conversations.get(session.sessionId)
        if (!conversation) throw new InputError(`会话已从导出中移除：${session.title}`)
        const messages = chatgptEvidence(conversation)
        if (!messages.some((message) => message.role === 'user')) throw new InputError(`会话没有可续接的用户文本：${session.title}`)
        selected.push({ ...session, messages: messages.length > 200 ? [...messages.slice(0, 10), ...messages.slice(-190)] : messages, truncated: messages.length > 200, messageCount: messages.length, fingerprint: exported.fingerprint })
      } else {
        const path = await localPath(session.sourcePath, 'file')
        if (extname(path).toLowerCase() !== '.jsonl') throw new InputError(`请选择 Claude Code 的 JSONL 会话：${session.title}`)
        const fingerprint = hash(await readText(path))
        const out = await service.importPath({ format: 'claude', path, preview: true, previewSample: 200 }, signal)
        if (!(out.turns > 0)) throw new InputError(`Claude Code 会话没有可导入的轮次：${session.title}`)
        if (hash(await readText(path)) !== fingerprint) throw new InputError(`会话正在更新，请重新预览：${session.title}`)
        const messages = (out.sample?.messages ?? []).filter((message) => ['user', 'assistant'].includes(message.role) && typeof message.text === 'string')
        if (out.sample?.truncated && service.resumeSummary) {
          try {
            const handoff = await service.resumeSummary({ format: 'claude', path, sessionId: session.sessionId }, signal)
            const last = handoff.lastUserPrompt
            if (typeof last === 'string' && last && last !== messages.findLast((message) => message.role === 'user')?.text) messages.push({ role: 'user', text: last, time: session.lastActiveAt })
          } catch (error) { if (signal?.aborted) throw error }
        }
        selected.push({ ...session, sourcePath: path, messages, truncated: out.sample?.truncated, messageCount: out.messages || messages.length, fingerprint })
      }
    }
    const workspace = scan.workspace
    const project = await inspectProject(workspace, scan.project.files.filter((file) => file.kind === '手动关联').map((file) => file.path))
    const summary = buildSummary({ workspace, sessions: selected, ...project })
    const planId = remember(plans, { workspace, selected: selected.map(({ messages, ...session }) => session), summary }, 12)
    return { planId, summary, workspace, sessions: selected.map(({ key, title, format, messageCount }) => ({ key, title, format, messageCount })), ...project }
  }

  async function apply(input) {
    const service = importer()
    const plan = recover(plans, input.planId, '迁移预览')
    if (applying) throw new InputError('已有迁移正在执行，请稍后重试。')
    applying = true
    try {
      const workspace = await localPath(plan.workspace, 'directory')
      let exported
      // Verify each selected file before any native session is written.
      for (const session of plan.selected) {
        if (session.format === 'chatgpt') {
          exported ??= await chatgptExport(session.sourcePath)
          if (exported.fingerprint !== session.fingerprint) throw new InputError('ChatGPT 导出已变更，请重新扫描。')
        } else if (hash(await readText(session.sourcePath)) !== session.fingerprint) {
          throw new InputError(`会话已变更，请重新预览：${session.title}`)
        }
      }
      // Put a native project session in place first. An empty DSH store otherwise
      // leaves dsh-chat-import 0.26.6 guessing the generation from its old default.
      const projectSessionId = await projectHost.prepare(workspace, `bridge-project-${hash(workspace).slice(0, 36)}`)
      const results = []
      for (const session of plan.selected) {
        try {
          const id = hash(JSON.stringify([workspace, session.format, session.sessionId])).slice(0, 36)
          const args = { workspaceMode: 'dedicated', workspaceDir: workspace, format: session.format, sessionId: `bridge-${id}` }
          if (session.format === 'chatgpt') {
            const conversation = exported.conversations.get(session.sessionId)
            const folder = join(stateDir, 'chatgpt')
            await mkdir(folder, { recursive: true, mode: 0o700 })
            // ChatGPT import treats every conversation in the source file as selected.
            // Pass just the selected conversation while retaining its original source ID.
            const destination = join(folder, `${id}.json`)
            const mapping = Object.fromEntries(Object.entries(conversation.mapping).map(([key, node]) => [key,
              node?.message?.author?.role === 'system' ? { ...node, message: null } : node,
            ]))
            const { title, create_time, update_time } = conversation
            const snapshot = JSON.stringify([{ id: conversation.id, title, create_time, update_time, mapping }])
            const previous = await readFile(destination, 'utf8').catch((error) => { if (error.code !== 'ENOENT') throw error })
            if (snapshot !== previous) {
              const temp = `${destination}.${randomUUID()}.tmp`
              try {
                await writeFile(temp, snapshot, { flag: 'wx', mode: 0o600 })
                await rename(temp, destination)
              } finally { await rm(temp, { force: true }) }
            }
            args.path = destination
          } else {
            args.path = session.sourcePath
            args.expectedHash = session.fingerprint
          }
          const out = await service.importPath(args)
          const result = resultFor(out, session, workspace)
          try {
            if (!await projectHost.includes(workspace, result.sessionId)) result.groupingWarning ||= '会话已写入，但 DSH 未将它归入选定工作区。'
          } catch (error) {
            result.groupingWarning ||= `会话已写入，工作区归组无法验证：${error.message}`
          }
          results.push(result)
        } catch (error) {
          results.push({ key: session.key, title: session.title, status: 'failed', error: error.message })
        }
      }
      return { results, summary: plan.summary, workspace, projectSessionId }
    } finally { applying = false }
  }

  return { scan, preview, apply }
}
