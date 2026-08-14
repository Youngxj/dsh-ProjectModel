#!/usr/bin/env node
/**
 * dsh-project-groups — one-command Node installer.
 *
 *   node install.mjs
 *   node install.mjs --home D:\mydsh --profile web
 *   node install.mjs --auto          # install, then restart the web service
 *
 * Steps:
 *   1. copy plugin files to $DSH_HOME/profiles/<profile>/plugins/dsh-project-groups/
 *   2. create directory links (junction on Windows, symlink elsewhere):
 *        profile side  -> $DSH_HOME/profiles/node_modules/dsh-project-groups
 *        install side  -> <dsh install>/node_modules/dsh-project-groups
 *   3. idempotently append the plugin row to cordis.patch.yml
 *   4. print restart & verification steps (or restart with --auto)
 */
import { createRequire } from 'node:module'
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN_NAME = 'dsh-project-groups'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const HOME = option('--home', process.env.DSH_HOME || join(homedir(), '.dsh'))
const PROFILE = option('--profile', 'web')
const AUTO = args.includes('--auto')
const FORCE = args.includes('--force')

const profileDir = join(HOME, 'profiles', PROFILE)
const pluginTarget = join(profileDir, 'plugins', PLUGIN_NAME)
const patchFile = join(profileDir, 'cordis.patch.yml')
const profileModules = join(HOME, 'profiles', 'node_modules')

const log = (msg) => console.log(msg)
const warn = (msg) => console.warn(`WARN: ${msg}`)

if (!existsSync(profileDir)) {
  console.error(`profile directory not found: ${profileDir}`)
  console.error(`run 'dsh --profile ${PROFILE}' once to initialize it, then re-run this installer`)
  process.exit(1)
}

// ---- 1. copy plugin files ------------------------------------------------
log(`==> [1/4] copying plugin files -> ${pluginTarget}`)
mkdirSync(join(pluginTarget, 'lib'), { recursive: true })
cpSync(join(SELF_DIR, 'lib'), join(pluginTarget, 'lib'), { recursive: true })
cpSync(join(SELF_DIR, 'package.json'), join(pluginTarget, 'package.json'))

// ---- 2. directory links ---------------------------------------------------
log('==> [2/4] creating directory links...')
mkdirSync(profileModules, { recursive: true })
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

function ensureLink(link, target, force) {
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink()) {
      const current = readlinkSync(link)
      if (current === target) return 'exists'
      if (!force) {
        warn(`link exists with a different target (${current}); keeping it (use --force to re-point)`)
        return 'kept'
      }
      rmSync(link, { recursive: true, force: true })
    } else {
      throw new Error(`path exists and is not a link: ${link}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link, linkType)
  return 'created'
}

const link1 = join(profileModules, PLUGIN_NAME)
const result1 = ensureLink(link1, pluginTarget, FORCE)
log(`    profile-side link (${result1}): ${link1}`)

// Resolve the dsh install root from the profile (bundles resolve there)
function resolveInstallRoot() {
  try {
    const require = createRequire(join(profileDir, 'cordis.yml'))
    const pkg = require.resolve('@deepseek-ai/dsh-base/package.json')
    const index = pkg.indexOf('node_modules')
    return index > 0 ? pkg.slice(0, index + 'node_modules'.length) : null
  } catch {
    return null
  }
}
const installRoot = resolveInstallRoot()
if (installRoot && existsSync(installRoot)) {
  const link2 = join(installRoot, PLUGIN_NAME)
  try {
    const result2 = ensureLink(link2, pluginTarget, FORCE)
    log(`    install-side link (${result2}): ${link2}`)
  } catch (error) {
    warn(`install-side link failed (may need an administrator shell): ${error.message}`)
    warn(`run manually as administrator: node -e "require('fs').symlinkSync('${pluginTarget.replace(/\\/g, '\\\\')}','${link2.replace(/\\/g, '\\\\')}','junction')"`)
  }
} else {
  warn('could not locate the dsh install (node_modules); the host half (API/tool) will NOT load without the install-side link')
  warn('find the install root from the profile dir with:')
  warn('  node -e "const {createRequire}=require(\'module\');console.log(createRequire(process.cwd()+\'/cordis.yml\').resolve(\'@deepseek-ai/dsh-base/package.json\'))"')
}

// ---- 3. register the plugin row --------------------------------------------
log('==> [3/4] registering plugin row in cordis.patch.yml...')
const block = `
# ---- user-installed: dsh-project-groups ----
- insert:
    - id: project-groups
      name: dsh-project-groups
`
let content = ''
try {
  content = readFileSync(patchFile, 'utf8')
} catch {
  /* file absent: start from scratch */
}
if (content.includes('project-groups')) {
  log('    cordis.patch.yml already contains the plugin row; skipped')
} else {
  writeFileSync(patchFile, content + block)
  log('    plugin row appended')
}

// ---- 4. next steps ----------------------------------------------------------
log('==> [4/4] install finished.')
if (AUTO) {
  log('    --auto: restarting the web service...')
  const { restart } = await import('./restart.mjs')
  await restart({ port: Number(option('--port', '3080')) })
} else {
  log('  Next steps:')
  log('  1. Restart dsh (Ctrl+C in the dsh terminal, then run "dsh web" again; or: node restart.mjs)')
  log('  2. Refresh the browser page (Ctrl+F5)')
  log('  3. Verify: open http://127.0.0.1:3080/api/project-groups - it should return JSON,')
  log('     and the Settings page gains a "project-groups" section')
}
