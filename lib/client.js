window.__ModuleLoader__.load({
  id: 'dsh-context-bridge',
  factory(require) {
    const { createElement: h, useEffect, useRef, useState } = require('react')
    const name = 'dsh-context-bridge'
    const inject = ['slots', 'uiWorkspace', 'sessions', 'conversation']

    const styles = `
      .context-bridge-dialog { color: light-dark(#25342d,#e4eee7); background: light-dark(#f8faf7,#202923); border: 1px solid light-dark(#c8d2ca,#506057); border-radius: 14px; padding: 0; width: min(760px, calc(100vw - 36px)); max-height: calc(100dvh - 40px); }
      .context-bridge-dialog::backdrop { background: #15241ac0; }
      .context-bridge { padding: 24px; font: 14px/1.55 system-ui,sans-serif; }
      .context-bridge h2 { margin: 0; font-size: 23px; letter-spacing: -.02em; }
      .context-bridge h3 { margin: 18px 0 6px; font-size: 15px; }
      .context-bridge header, .context-bridge .actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
      .context-bridge small { color: light-dark(#4a6152,#adc0b3); overflow-wrap: anywhere; }
      .context-bridge p { margin: 7px 0; }
      .context-bridge input:not([type=checkbox]), .context-bridge textarea { display: block; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid light-dark(#a6baac,#607668); background: light-dark(#fff,#151d18); color: inherit; font: inherit; }
      .context-bridge .path { display: flex; align-items: end; gap: 8px; margin: 12px 0; }
      .context-bridge .path label { flex: 1; min-width: 0; }
      .context-bridge label.field { display: block; margin: 12px 0; }
      .context-bridge button, .context-bridge-trigger { padding: 6px 10px; border: 1px solid light-dark(#a6baac,#607668); border-radius: 6px; background: transparent; font: inherit; color: inherit; cursor: pointer; }
      .context-bridge button.primary { background: light-dark(#22533d,#a8d9bb); border-color: transparent; color: light-dark(#fff,#14241a); font-weight: 600; }
      .context-bridge button:disabled { opacity: .55; cursor: default; }
      .context-bridge button:focus-visible, .context-bridge input:focus-visible, .context-bridge textarea:focus-visible { outline: 2px solid light-dark(#22533d,#a8d9bb); outline-offset: 2px; }
      .context-bridge .rows { padding: 0; max-height: min(34vh, 310px); overflow: auto; margin: 6px 0; list-style: none; }
      .context-bridge .rows li { border-bottom: 1px solid light-dark(#d6dfd7,#47574b); padding: 8px 0; overflow-wrap: anywhere; }
      .context-bridge .rows label { display: flex; align-items: start; gap: 8px; cursor: pointer; }
      .context-bridge .rows input { margin-top: 5px; }
      .context-bridge .rows small { display: block; }
      .context-bridge .actions { margin-top: 16px; }
      .context-bridge .error { color: light-dark(#a42825,#ffada3); overflow-wrap: anywhere; }
      .context-bridge .summary { min-height: 220px; max-height: 50vh; resize: vertical; white-space: pre-wrap; }
      .context-bridge details ul { margin: 6px 0; padding-left: 22px; overflow-wrap: anywhere; }
      @media (max-width: 520px) { .context-bridge { padding: 14px; } .context-bridge .path { flex-wrap: wrap; } }
    `

    const sourceName = { chatgpt: 'ChatGPT', claude: 'Claude Code' }
    const statusName = { imported: '已导入', 'already-imported': '此前已导入', appended: '已更新', replaced: '已更新', failed: '导入失败' }

    async function request(action, body) {
      const response = await fetch('api/dsh-context-bridge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result) throw new Error(result?.error || `无法访问迁移服务（HTTP ${response.status}）。请检查插件是否启用。`)
      return result
    }

    function details(label, values, textOf) {
      if (!values?.length) return null
      return h('details', null, h('summary', null, `${label} (${values.length})`), h('ul', null, values.map((value, index) => h('li', { key: index }, textOf(value)))))
    }

    function Dialog({ ctx, state }) {
      const dialog = useRef(null)
      const [open, setOpen] = useState(false)
      const [workspace, setWorkspace] = useState('')
      const [chatgptPath, setChatgptPath] = useState('')
      const [includeClaude, setIncludeClaude] = useState(false)
      const [claudePath, setClaudePath] = useState('')
      const [keywords, setKeywords] = useState('')
      const [files, setFiles] = useState('')
      const [scan, setScan] = useState(null)
      const [keys, setKeys] = useState([])
      const [filter, setFilter] = useState('')
      const [visibleCount, setVisibleCount] = useState(50)
      const [preview, setPreview] = useState(null)
      const [result, setResult] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')

      useEffect(() => {
        state.show = () => setOpen(true)
        return () => { state.show = undefined }
      }, [state])
      useEffect(() => {
        if (open && !dialog.current.open) dialog.current.showModal()
        if (!open && dialog.current.open) dialog.current.close()
      }, [open])

      async function run(label, callback) {
        setError('')
        setBusy(label)
        try { await callback() } catch (caught) { setError(caught.message) } finally { setBusy('') }
      }

      function startScan(event) {
        event.preventDefault()
        void run('正在扫描会话…', async () => {
          const data = await request('scan', { workspace: workspace.trim(), chatgptPath: chatgptPath.trim(), includeClaude, claudePath: claudePath.trim(), keywords: keywords.split(/[,，\n]/).map((word) => word.trim()).filter(Boolean), files: files.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) })
          setKeys(data.sessions.filter((session) => session.reason).slice(0, 12).map((session) => session.key))
          setFilter('')
          setVisibleCount(50)
          setScan(data)
        })
      }

      async function openSession(sessionId) {
        await ctx.sessions.using(sessionId, { source: 'dsh-context-bridge' }, async (ref) => {
          await ref.ready
          const draft = ctx.conversation.input.requestDraftInitialization(ref.binding, { prompt: result.summary, whenDraftExists: 'keep' })
          ctx.uiWorkspace.openSession(sessionId)
          if (draft === 'applied') setOpen(false)
          else setError('会话已打开，输入框里有现有草稿或正在发送。可以保留原内容并手动复制交接摘要。')
        })
      }

      const filtered = (scan?.sessions ?? []).filter((row) => `${row.title} ${sourceName[row.format]} ${row.reason}`.toLowerCase().includes(filter.trim().toLowerCase()))
      const step = result ? '导入结果' : preview ? '迁移预览' : scan ? '选择会话' : '项目迁移'
      const button = (label, onClick, options = {}) => h('button', { type: 'button', disabled: Boolean(busy), onClick, ...options }, label)

      function inputs() {
        return h('form', { onSubmit: startScan },
          h('fieldset', { disabled: Boolean(busy), style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
            h('div', { className: 'path' }, h('label', null, '本地项目目录', h('input', { value: workspace, required: true, onChange: (event) => setWorkspace(event.target.value) })),
              button('浏览…', () => void run('正在选择目录…', async () => { const path = await ctx.uiWorkspace.pickDirectory(); if (path) setWorkspace(path) }))),
            h('label', { className: 'field' }, 'ChatGPT 导出文件', h('input', { value: chatgptPath, placeholder: '解压后 conversations.json 的绝对路径', onChange: (event) => setChatgptPath(event.target.value) })),
            h('label', null, h('input', { type: 'checkbox', checked: includeClaude, onChange: (event) => setIncludeClaude(event.target.checked) }), ' 扫描 Claude Code'),
            includeClaude && h('label', { className: 'field' }, 'Claude Code 来源路径', h('input', { value: claudePath, placeholder: '留空使用 ~/.claude/projects', onChange: (event) => setClaudePath(event.target.value) })),
            h('label', { className: 'field' }, '项目关键词（可选，逗号分隔）', h('input', { value: keywords, placeholder: '例如 任务列表、搜索功能', onChange: (event) => setKeywords(event.target.value) })),
            h('label', { className: 'field' }, '补充项目文件（可选，每行一个路径）', h('textarea', { rows: 2, value: files, placeholder: '例如 Docs/开发笔记.md', onChange: (event) => setFiles(event.target.value) })),
            h('div', { className: 'actions' }, h('small', null, '扫描和预览在 DSH 主机上进行。'), h('button', { type: 'submit', className: 'primary' }, '扫描会话'))))
      }

      function selection() {
        return h('div', null,
          h('p', null, h('small', null, scan.workspace)),
          h('label', { className: 'field' }, '搜索会话', h('input', { value: filter, onChange: (event) => { setFilter(event.target.value); setVisibleCount(50) } })),
          h('p', null, `选中 ${keys.length} / 12 · 匹配 ${filtered.length} 个`),
          filtered.length === 0 && h('p', null, '没有找到会话。检查来源路径或搜索条件。'),
          h('ul', { className: 'rows' }, filtered.slice(0, visibleCount).map((row) => h('li', { key: row.key }, h('label', null,
            h('input', { type: 'checkbox', checked: keys.includes(row.key), disabled: Boolean(busy) || (keys.length >= 12 && !keys.includes(row.key)),
              onChange: (event) => setKeys((current) => event.target.checked ? [...current, row.key] : current.filter((key) => key !== row.key)) }),
            h('span', null, row.title, h('small', null, `${sourceName[row.format]} · ${row.reason || '手动选择'}`)))))),
          filtered.length > visibleCount && button('显示更多', () => setVisibleCount((count) => count + 50)),
          details('扫描提示', scan.warnings, (warning) => warning),
          h('div', { className: 'actions' }, button('返回', () => { setError(''); setScan(null) }),
            button('预览迁移', () => void run('正在整理交接摘要…', async () => setPreview(await request('preview', { scanId: scan.scanId, keys }))), { className: 'primary', disabled: Boolean(busy) || keys.length === 0 })))
      }

      function showPreview() {
        return h('div', null,
          h('p', null, h('small', null, preview.workspace)),
          details('待导入会话', preview.sessions, (row) => `${sourceName[row.format]} · ${row.title}（${row.messageCount} 条文本）`),
          details('关联项目文件', preview.files, (row) => `${row.kind} · ${row.path}`),
          details('Skills、MCP 与 Hooks（仅预览）', preview.configs, (row) => `${row.kind} · ${row.path}`),
          details('预览提示', preview.warnings, (row) => row),
          h('label', { className: 'field' }, '交接摘要', h('textarea', { className: 'summary', rows: 9, value: preview.summary, readOnly: true })),
          h('div', { className: 'actions' }, button('返回', () => { setError(''); setPreview(null) }),
            button(`导入 ${preview.sessions.length} 个会话`, () => void run('正在导入到 DSH…', async () => setResult(await request('apply', { planId: preview.planId }))), { className: 'primary' })))
      }

      function showResult() {
        return h('div', null, h('p', null, h('small', null, result.workspace)),
          h('ul', { className: 'rows' }, result.results.map((row) => h('li', { key: row.key },
            h('strong', null, row.title), h('small', null, statusName[row.status] ?? row.status),
            row.error && h('p', { className: 'error' }, row.error),
            row.groupingWarning && h('small', { className: 'error' }, `归组提示：${row.groupingWarning}`),
            row.sessionId && button('打开并填入续接草稿', () => void run('正在打开会话…', () => openSession(row.sessionId)))))),
          h('label', { className: 'field' }, '交接摘要', h('textarea', { className: 'summary', rows: 7, value: result.summary, readOnly: true })),
          h('div', { className: 'actions' }, button('返回预览', () => { setError(''); setResult(null) }),
            button('复制摘要', () => void run('正在复制…', () => navigator.clipboard.writeText(result.summary))),
            button('打开项目并续接', () => void run('正在打开项目…', () => openSession(result.projectSessionId)), { className: 'primary' })))
      }

      return h('dialog', { ref: dialog, className: 'context-bridge-dialog', 'aria-labelledby': 'context-bridge-title', onClose: () => setOpen(false), onCancel: (event) => { if (busy) event.preventDefault() } },
        h('style', null, styles), h('div', { className: 'context-bridge' },
          h('header', null, h('h2', { id: 'context-bridge-title' }, step), button('关闭', () => setOpen(false))),
          busy && h('p', { role: 'status' }, busy), error && h('p', { className: 'error', role: 'alert' }, error),
          result ? showResult() : preview ? showPreview() : scan ? selection() : inputs()))
    }

    function apply(ctx) {
      const state = {}
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: name, order: 10 }, ({ wide }) =>
        h('button', { className: 'context-bridge-trigger', type: 'button', title: '项目迁移', 'aria-label': '项目迁移', onClick: () => state.show?.() }, wide ? '项目迁移' : '↪')))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: name, inject: () => ({}) }, () => h(Dialog, { ctx, state })))
    }

    return { name, inject, apply }
  },
})
