#!/usr/bin/env node
/**
 * dsh-ProjectModel — restart the DeepSeek Harness web service.
 *
 *   node restart.mjs
 *   node restart.mjs --port 3080
 *
 * Locates the node process listening on the port, stops it, waits for the
 * port to release, starts "dsh web" in the background (logs written to
 * dsh-restart.out.log / dsh-restart.err.log), then verifies the endpoint.
 * Also exported for install.mjs --auto.
 */
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, openSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const PORT = Number(option('--port', '3080'))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listenerPid(port) {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
    for (const line of out.split(/\r?\n/)) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (/^\d+$/.test(pid)) return Number(pid)
      }
    }
  } catch {
    /* netstat unavailable */
  }
  return null
}

async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await listenerPid(port)) === null) return true
    await sleep(500)
  }
  return (await listenerPid(port)) === null
}

export async function restart({ port = PORT } = {}) {
  const logOut = join(SELF_DIR, 'dsh-restart.out.log')
  const logErr = join(SELF_DIR, 'dsh-restart.err.log')

  // locate the dsh install by resolving a bundle from the web profile
  const profileDir = join(homedir(), '.dsh', 'profiles', 'web')
  let dshBin = null
  try {
    const require = createRequire(join(profileDir, 'cordis.yml'))
    const pkg = require.resolve('@deepseek-ai/dsh/package.json')
    dshBin = join(dirname(pkg), 'lib', 'bin.js')
  } catch {
    /* fall through */
  }
  if (!dshBin || !existsSync(dshBin)) {
    throw new Error(`cannot locate the dsh install (resolved: ${dshBin}) — run "dsh web" manually`)
  }

  console.log(`==> locating the process listening on port ${port}...`)
  const pid = await listenerPid(port)
  if (pid !== null) {
    console.log(`  found PID ${pid}; stopping in 3 seconds (let the session settle)...`)
    await sleep(3000)
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  } else {
    console.log('  no listener; starting directly.')
  }

  console.log('==> waiting for the port to release...')
  if (!(await waitForPortFree(port, 30000))) {
    throw new Error('port did not release; aborting.')
  }

  console.log('==> starting dsh web (background)...')
  const outFd = openSync(logOut, 'a')
  const errFd = openSync(logErr, 'a')
  const child = spawn(process.execPath, [dshBin, 'web'], {
    cwd: homedir(),
    detached: true,
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
  })
  child.unref()
  console.log(`  started, new PID: ${child.pid}`)

  console.log('==> waiting for the service and verifying the endpoint...')
  const deadline = Date.now() + 60000
  let ready = false
  while (Date.now() < deadline) {
    await sleep(2000)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/project-groups`)
      if (res.status === 200 || res.status === 404) ready = true
    } catch {
      /* not up yet */
    }
    if (ready) break
  }
  if (ready) {
    console.log(`OK: dsh web restarted; /api/project-groups is reachable. Refresh the browser page (Ctrl+F5).`)
  } else {
    console.warn(`WARN: service not ready within 60s. Check ${logErr}, or start manually: node "${dshBin}" web`)
  }
}

function existsSyncSafe(path) {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

// run directly: node restart.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  restart({ port: PORT }).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
