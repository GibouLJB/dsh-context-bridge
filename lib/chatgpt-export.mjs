import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, posix } from 'node:path'
import yauzl from 'yauzl'
import { InputError } from './project.mjs'

export const maxFileBytes = 256 * 1024 * 1024

async function readBounded(stream, limit, signal) {
  const chunks = []
  let size = 0
  for await (const chunk of stream) {
    signal?.throwIfAborted()
    size += chunk.length
    if (size > limit) throw new InputError('会话数据超过 256 MiB。')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

export async function chatgptExport(path, signal) {
  const conversations = new Map()
  const fingerprint = createHash('sha256')
  let remaining = maxFileBytes
  function add(bytes, name) {
    remaining -= bytes.length
    fingerprint.update(JSON.stringify([name, bytes.length])).update(bytes)
    let rows
    try { rows = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) } catch {
      throw new InputError(`${name} 不是有效的 JSON。`)
    }
    if (!Array.isArray(rows)) throw new InputError(`${name} 不包含 ChatGPT 会话数组。`)
    for (const obj of rows) {
      const id = obj?.id || obj?.conversation_id
      if (typeof id !== 'string' || !obj.mapping || typeof obj.mapping !== 'object') continue
      if (conversations.has(id)) throw new InputError(`ChatGPT 导出中存在重复会话 ID：${id}`)
      conversations.set(id, { ...obj, id })
    }
  }

  try {
    const extension = extname(path).toLowerCase()
    if (extension === '.json') {
      const info = await stat(path)
      if (!info.isFile() || info.size > maxFileBytes) throw new InputError('请选择不超过 256 MiB 的会话 JSON 文件。')
      add(await readBounded(createReadStream(path, { signal }), remaining, signal), 'ChatGPT 会话文件')
    } else if (extension === '.zip') {
      const zip = await yauzl.openPromise(path, { lazyEntries: true, autoClose: false })
      try {
        let matched = false
        for await (const entry of zip.eachEntry()) {
          signal?.throwIfAborted()
          if (!/^conversations(?:[-_]?\d+)?\.json$/i.test(posix.basename(entry.fileName)) || entry.fileName.endsWith('/')) continue
          matched = true
          if (entry.uncompressedSize > remaining) throw new InputError('ZIP 内的会话数据合计超过 256 MiB。')
          add(await readBounded(await zip.openReadStreamPromise(entry), remaining, signal), entry.fileName)
        }
        if (!matched) throw new InputError('ZIP 中找不到 conversations.json 或带编号的会话 JSON 文件。')
      } finally { zip.close() }
    } else {
      throw new InputError('请选择 ChatGPT 导出的 ZIP 或会话 JSON 文件。')
    }
    if (!conversations.size) throw new InputError('ChatGPT 导出文件中没有可识别的会话。')
    return { conversations, fingerprint: fingerprint.digest('hex') }
  } catch (error) {
    signal?.throwIfAborted()
    if (error instanceof InputError) throw error
    throw new InputError('无法读取 ChatGPT 导出文件。请检查读取权限，或重新下载未加密的导出 ZIP。')
  }
}
