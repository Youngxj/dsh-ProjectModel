import { defineTool } from '@deepseek-ai/dsh-tools'
import s from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

const NS = settingsNamespace('project-groups')

const ProjectGroupsSettingsSchema = s.object({
  groups: s.array(s.object({
    id: s.string(),
    name: s.string(),
    folders: s.array(s.object({
      id: s.string(),
      path: s.string(),
      title: s.string(),
    })),
  })).default([]),
  activeGroupId: s.string().required(false),
  activeFolderId: s.string().required(false),
}).default({})

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(data.length > 0 ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function writeJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

export default {
  name: 'dsh-project-groups',
  inject: ['settings', 'webServer', 'tools', 'systemPrompt'],
  async apply(ctx) {
    const fs = ctx.get('fs')
    const subprocess = ctx.get('subprocess')
    const timer = ctx.get('timer')

    const state = {
      groups: [],
      activeGroupId: null,
      activeFolderId: null,
    }
    let seq = 1
    const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

    // ── durable state: settings namespace ──────────────────────────────────
    const settings = ctx.get('settings')
    let scope
    if (settings) {
      scope = settings.register(NS, ProjectGroupsSettingsSchema)
      const saved = scope.get()
      if (saved && Array.isArray(saved.groups)) {
        // settings resolved values are deep-frozen; clone into mutable state
        state.groups = saved.groups.map((g) => ({
          id: g.id,
          name: g.name,
          folders: g.folders.map((f) => ({ id: f.id, path: f.path, title: f.title })),
        }))
        if (typeof saved.activeGroupId === 'string') state.activeGroupId = saved.activeGroupId
        if (typeof saved.activeFolderId === 'string') state.activeFolderId = saved.activeFolderId
      }
    }

    function markDirty() {
      if (!scope) return
      scope.update({
        groups: state.groups,
        activeGroupId: state.activeGroupId,
        activeFolderId: state.activeFolderId,
      }).catch((error) => console.error('[project-groups] settings save failed:', error && error.message))
    }

    function snapshot() {
      return {
        groups: state.groups.map((g) => ({ id: g.id, name: g.name, folders: g.folders.map((f) => ({ id: f.id, path: f.path, title: f.title })) })),
        activeGroupId: state.activeGroupId,
        activeFolderId: state.activeFolderId,
      }
    }
    function findGroup(id) {
      return state.groups.find((g) => g.id === id)
    }
    function findFolder(folderId) {
      for (const g of state.groups) {
        const f = g.folders.find((x) => x.id === folderId)
        if (f) return { group: g, folder: f }
      }
      return undefined
    }
    function err(message) {
      return { ok: false, error: message }
    }
    function ok(value) {
      return value === undefined ? { ok: true } : { ok: true, ...value }
    }

    async function resolveFolder(args) {
      const folderId = args && typeof args.folderId === 'string' ? args.folderId : state.activeFolderId
      if (!folderId) throw new Error('尚未设置当前项目文件夹：请先在“设置 → 项目组”中添加文件夹并设为当前。')
      const hit = findFolder(folderId)
      if (!hit) throw new Error('未知的文件夹 id: ' + folderId)
      return hit
    }

    async function resolveInsideFolder(folder, relPath) {
      if (!fs) throw new Error('fs 服务不可用')
      const root = await fs.resolve(folder.path)
      const target = await fs.resolve(relPath, { cwd: folder.path })
      if (!fs.contains(root, target)) throw new Error('路径越出项目文件夹范围: ' + relPath)
      return target
    }

    async function resolveShell() {
      if (subprocess) {
        try {
          const resolved = await subprocess.resolveExecutable('pwsh')
          if (typeof resolved === 'string' && resolved.length > 0) return resolved
        } catch (e) {
          /* fall through to well-known locations */
        }
      }
      if (fs) {
        const candidates = [
          'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        ]
        for (const candidate of candidates) {
          try {
            const target = await fs.resolve(candidate)
            const info = await fs.stat(target)
            if (info && info.type === 'file') return fs.processPath(target)
          } catch (e) {
            /* try next candidate */
          }
        }
      }
      return 'pwsh'
    }

    const aliasMap = {
      list: 'list',
      setactive: 'setActive',
      set_active: 'setActive',
      read: 'readFile',
      readfile: 'readFile',
      read_file: 'readFile',
      write: 'writeFile',
      writefile: 'writeFile',
      write_file: 'writeFile',
      listdir: 'listDir',
      list_dir: 'listDir',
      run: 'run',
      creategroup: 'createGroup',
      create_group: 'createGroup',
      renamegroup: 'renameGroup',
      rename_group: 'renameGroup',
      deletegroup: 'deleteGroup',
      delete_group: 'deleteGroup',
      addfolder: 'addFolder',
      add_folder: 'addFolder',
      removefolder: 'removeFolder',
      remove_folder: 'removeFolder',
    }
    function normalizeAction(action) {
      const key = String(action || '').replace(/[-_]/g, '').toLowerCase()
      return aliasMap[key] || action
    }

    const handlers = {
      'pg.list': async () => snapshot(),

      'pg.createGroup': async (args) => {
        const name = String((args && args.name) || '').trim()
        if (!name) return err('组名不能为空')
        const g = { id: uid('g'), name, folders: [] }
        state.groups.push(g)
        if (!state.activeGroupId) state.activeGroupId = g.id
        markDirty()
        return snapshot()
      },

      'pg.renameGroup': async (args) => {
        const name = String((args && args.name) || '').trim()
        const g = args && findGroup(args.id)
        if (!g) return err('未找到该项目组')
        if (!name) return err('组名不能为空')
        g.name = name
        markDirty()
        return snapshot()
      },

      'pg.deleteGroup': async (args) => {
        const g = args && findGroup(args.id)
        if (!g) return err('未找到该项目组')
        state.groups = state.groups.filter((x) => x.id !== g.id)
        if (state.activeGroupId === g.id) {
          state.activeGroupId = state.groups[0] ? state.groups[0].id : null
          state.activeFolderId = null
        }
        markDirty()
        return snapshot()
      },

      'pg.addFolder': async (args) => {
        const g = args && findGroup(args.groupId)
        if (!g) return err('未找到该项目组')
        const path = String((args && args.path) || '').trim()
        if (!path) return err('文件夹路径不能为空')
        if (!fs) return err('fs 服务不可用')
        let target
        try {
          target = await fs.resolve(path)
        } catch (e) {
          return err('路径无法解析: ' + (e && e.message ? e.message : String(e)))
        }
        const info = await fs.stat(target)
        if (!info) return err('路径不存在: ' + path)
        if (info.type !== 'directory') return err('不是文件夹: ' + path)
        const canonical = fs.processPath(target)
        if (g.folders.some((f) => f.path.toLowerCase() === canonical.toLowerCase())) return err('该文件夹已在项目组中: ' + canonical)
        const title = String((args && args.title) || '').trim() || String(canonical).split(/[\\/]/).filter(Boolean).pop() || canonical
        const f = { id: uid('f'), path: canonical, title }
        g.folders.push(f)
        if (!state.activeGroupId) state.activeGroupId = g.id
        if (!state.activeFolderId) state.activeFolderId = f.id
        markDirty()
        return snapshot()
      },

      'pg.removeFolder': async (args) => {
        const g = args && findGroup(args.groupId)
        if (!g) return err('未找到该项目组')
        const f = g.folders.find((x) => x.id === args.folderId)
        if (!f) return err('未找到该文件夹')
        g.folders = g.folders.filter((x) => x.id !== f.id)
        if (state.activeFolderId === f.id) state.activeFolderId = g.folders[0] ? g.folders[0].id : null
        markDirty()
        return snapshot()
      },

      'pg.setActive': async (args) => {
        if (args && typeof args.groupId === 'string') {
          const g = findGroup(args.groupId)
          if (!g) return err('未找到该项目组')
          state.activeGroupId = g.id
          state.activeFolderId = g.folders[0] ? g.folders[0].id : null
        }
        if (args && typeof args.folderId === 'string') {
          const hit = findFolder(args.folderId)
          if (!hit) return err('未找到该文件夹')
          state.activeFolderId = hit.folder.id
          state.activeGroupId = hit.group.id
        }
        markDirty()
        return snapshot()
      },

      'pg.readFile': async (args) => {
        const { folder } = await resolveFolder(args)
        const target = await resolveInsideFolder(folder, String((args && args.path) || ''))
        try {
          return ok({ content: await fs.readText(target) })
        } catch (e) {
          return err('读取失败: ' + (e && e.message ? e.message : String(e)))
        }
      },

      'pg.writeFile': async (args) => {
        const { folder } = await resolveFolder(args)
        const target = await resolveInsideFolder(folder, String((args && args.path) || ''))
        try {
          await fs.writeText(target, String((args && args.content) || ''), undefined, undefined, { mode: 'workspace-write', workspaceRoot: folder.path })
          markDirty()
          return ok({})
        } catch (e) {
          return err('写入失败: ' + (e && e.message ? e.message : String(e)))
        }
      },

      'pg.listDir': async (args) => {
        const { folder } = await resolveFolder(args)
        const rel = String((args && args.path) || '')
        let target
        if (rel.trim().length > 0) {
          target = await resolveInsideFolder(folder, rel)
        } else {
          if (!fs) throw new Error('fs 服务不可用')
          target = await fs.resolve(folder.path)
        }
        try {
          const entries = await fs.listDir(target)
          return ok({ entries: entries.map((e) => ({ name: e.name, type: e.type })) })
        } catch (e) {
          return err('列表失败: ' + (e && e.message ? e.message : String(e)))
        }
      },

      'pg.run': async (args) => {
        const { folder } = await resolveFolder(args)
        const command = String((args && args.command) || '').trim()
        if (!command) return err('命令不能为空')
        if (!subprocess) return err('subprocess 服务不可用')
        const timeoutMs = Number(args && args.timeoutMs) > 0 ? Number(args.timeoutMs) : 120000
        const shell = await resolveShell()
        const handle = subprocess.spawn({
          argv: [shell, '-NoProfile', '-NonInteractive', '-Command', command],
          cwd: folder.path,
          env: {},
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 2000000, spill: { maxBytes: 20000000 } },
            stderr: { maxBytes: 2000000, spill: { maxBytes: 20000000 } },
          },
          graceMs: 2000,
        })
        let timedOut = false
        let disposer
        if (timer) disposer = timer.timeout(() => {
          timedOut = true
          try { handle.terminate() } catch (e) { /* already gone */ }
        }, timeoutMs)
        try {
          const outcome = await handle.done
          const stdout = handle.collected && handle.collected.stdout ? handle.collected.stdout.finalize() : null
          const stderr = handle.collected && handle.collected.stderr ? handle.collected.stderr.finalize() : null
          return ok({
            exitCode: outcome.exitCode,
            timedOut,
            stdout: stdout ? stdout.text : '',
            stderr: stderr ? stderr.text : '',
          })
        } catch (e) {
          return err('命令启动失败: ' + (e && e.message ? e.message : String(e)))
        } finally {
          if (disposer) disposer()
        }
      },
    }

    // ── browser-facing HTTP API ────────────────────────────────────────────
    const webServer = ctx.get('webServer')
    if (webServer) {
      webServer.register({
        kind: 'exact',
        path: '/api/project-groups',
        handler: async (req, res) => {
          try {
            let action
            let args = {}
            if ((req.method || 'GET').toUpperCase() === 'POST') {
              const body = await readJsonBody(req)
              action = body && body.action
              args = body || {}
            } else {
              const url = new URL(req.url || '/', 'http://x')
              action = url.searchParams.get('action')
              for (const [key, value] of url.searchParams.entries()) args[key] = value
            }
            delete args.action
            const normalized = normalizeAction(action || 'list')
            const fn = handlers['pg.' + normalized]
            const result = fn ? await fn(args) : err('未知动作: ' + String(action || ''))
            writeJson(res, result && result.ok === false ? 400 : 200, result)
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error && error.message ? error.message : String(error) })
          }
        },
      })
    }

    // ── model tool: project ────────────────────────────────────────────────
    const tools = ctx.get('tools')
    if (tools) {
      tools.register(defineTool({
        name: 'project',
        description: '项目组工具：在当前会话中跨多个项目文件夹工作。项目组在“设置 → 项目组”中维护：一组可包含多个项目文件夹，组内当前文件夹可随时切换。动作：list 列出所有项目组与文件夹及其 id；setActive 切换当前文件夹（传 folderId）；readFile 读取当前文件夹内文件；writeFile 写入/新建当前文件夹内文件；listDir 列出当前文件夹内目录；run 在当前文件夹中运行命令（git/npm 等，经 PowerShell 执行）。也支持管理动作 createGroup/addFolder/removeFolder/deleteGroup。动作名同时接受别名：read、write、list_dir、set_active 等。文件路径一律是相对当前文件夹的路径（如 package.json、src/main.ts）。未配置项目组时应提示用户先到“设置 → 项目组”添加文件夹。',
        parameters: {
          action: { type: 'string', required: true, description: '动作：list | setActive | readFile | writeFile | listDir | run（也接受 read/write/list_dir/set_active 等别名）' },
          folderId: { type: 'string', description: '目标文件夹 id；省略时使用当前文件夹' },
          path: { type: 'string', description: '相对当前文件夹的文件/目录路径（readFile/writeFile/listDir 使用）' },
          content: { type: 'string', description: '写入的文件内容（writeFile 使用）' },
          command: { type: 'string', description: '要运行的命令（run 使用，如 git status / npm test）' },
          timeoutMs: { type: 'number', description: '命令超时毫秒数，默认 120000' },
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value || {}, null, 2) }],
        },
        async execute(args) {
          try {
            const action = normalizeAction(args && args.action)
            const fn = handlers['pg.' + action]
            if (!fn) return { ok: false, error: '未知动作: ' + String((args && args.action) || '') }
            return await fn(args || {})
          } catch (e) {
            return { ok: false, error: (e && e.message ? e.message : String(e)) }
          }
        },
      }))
    }

    // ── prompt context: current group state for every agent ────────────────
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt) {
      const disposer = systemPrompt.context({
        name: 'project:groups',
        order: 130,
        text: () => {
          const g = state.activeGroupId ? findGroup(state.activeGroupId) : undefined
          const f = state.activeFolderId ? findFolder(state.activeFolderId) : undefined
          if (!g) return '项目组：未配置。可使用 project 工具，或请用户到“设置 → 项目组”添加项目文件夹。'
          const folderLine = g.folders.length === 0
            ? '（空）'
            : g.folders.map((x) => x.title + ' ' + x.path + (x.id === state.activeFolderId ? ' ←当前' : '')).join('；')
          return '项目组：' + g.name + '（当前文件夹：' + (f ? f.folder.title + ' ' + f.folder.path : '未设置') + '）\n组内文件夹：' + folderLine
        },
      })
      if (disposer) ctx.effect(() => disposer)
    }

    console.log('[project-groups] ready with', state.groups.length, 'group(s)')
  },
}
