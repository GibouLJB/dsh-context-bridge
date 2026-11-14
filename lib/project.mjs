import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, join, isAbsolute } from 'node:path'
import { within } from './context.mjs'

export class InputError extends Error {}

export async function localPath(path, type) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0')) throw new InputError('请输入 DSH 主机上的绝对路径。')
  let canonical, info
  try {
    canonical = await realpath(path)
    info = await stat(canonical)
  } catch (error) {
    throw new InputError(`无法访问 ${path}（${error.code ?? '文件系统错误'}）。`)
  }
  if ((type === 'directory' && !info.isDirectory()) || (type === 'file' && !info.isFile())) throw new InputError(`路径类型不符：${path}`)
  return canonical
}

const ignored = new Set(['node_modules', 'dist', 'build', 'vendor', 'binaries', 'intermediate', 'saved', 'deriveddatacache'])
const projectMarker = /^(README(?:\..+)?|AGENTS\.md|CLAUDE\.md|package\.json|pyproject\.toml|Cargo\.toml|go\.mod|CMakeLists\.txt|.+\.(uproject|sln|csproj))$/i

async function optional(path, operation) {
  try { return await operation(path) } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined
    throw error
  }
}

export async function inspectProject(workspace, additionalFiles) {
  const files = new Map()
  const configs = []
  const warnings = []
  const entries = (await readdir(workspace, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ignored.has(entry.name.toLowerCase())) continue
    if (entry.isFile() && projectMarker.test(entry.name)) files.set(entry.name, { path: entry.name, kind: '项目文件' })
    if (entry.isDirectory() && files.size < 30) files.set(entry.name, { path: entry.name, kind: '项目目录' })
  }
  for (const path of additionalFiles) {
    const absolute = resolve(workspace, path)
    if (!within(workspace, absolute)) throw new InputError(`补充文件需位于项目目录内：${path}`)
    const canonical = await localPath(absolute, 'file')
    if (!within(workspace, canonical)) throw new InputError(`补充文件指向项目目录以外：${path}`)
    const rel = relative(workspace, canonical)
    files.delete(rel)
    files.set(rel, { path: rel, kind: '手动关联' })
  }

  for (const base of ['.claude/skills', '.agents/skills']) {
    const canonicalBase = await optional(join(workspace, base), realpath)
    if (!canonicalBase || !within(workspace, canonicalBase)) continue
    const skills = await optional(canonicalBase, readdir)
    for (const skill of (skills ?? []).sort().slice(0, 20)) {
      const path = join(base, skill, 'SKILL.md')
      const absolute = await optional(join(workspace, path), realpath)
      if (absolute && within(workspace, absolute) && (await stat(absolute)).isFile()) configs.push({ kind: 'Skill', path })
    }
  }
  for (const [kind, path] of [['MCP', '.mcp.json'], ['MCP / Hooks', '.claude/settings.json'], ['MCP / Hooks', '.claude/settings.local.json']]) {
    const absolute = await optional(join(workspace, path), realpath)
    if (!absolute || !within(workspace, absolute)) continue
    const info = await stat(absolute)
    if (!info.isFile()) continue
    if (kind === 'MCP') configs.push({ kind, path })
    try {
      if (info.size > 256 * 1024) throw new Error('文件过大')
      const config = JSON.parse((await readFile(absolute, 'utf8')).replace(/^\uFEFF/, ''))
      if (config?.hooks && typeof config.hooks === 'object' && Object.keys(config.hooks).length) configs.push({ kind: 'Hooks', path })
      if (kind !== 'MCP' && config?.mcpServers && typeof config.mcpServers === 'object' && Object.keys(config.mcpServers).length) configs.push({ kind: 'MCP', path })
    } catch {
      warnings.push(`配置文件需要手动检查：${path}`)
    }
  }
  const listed = Array.from(files.values()).sort((a, b) => Number(b.kind === '手动关联') - Number(a.kind === '手动关联') || Number(b.kind === '项目文件') - Number(a.kind === '项目文件'))
  return { files: listed.slice(0, 50), configs, warnings }
}
