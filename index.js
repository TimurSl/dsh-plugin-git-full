import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  GitPluginError, assertSshUrl, branches, checkout, clone, commit, diff, fetch,
  generateSshKey, history, pullFastForward, push, readExistingKey, repositoryTitle,
  sshEnvironment, stage, status, workspaceDestination, writeManagedKey,
} from './git-core.js'

export const name = 'dsh-git-workspace-plugin'
export const inject = ['webServer', 'credentials']

/** @type {import('@deepseek-ai/schemastery').default} */
export const Config = undefined

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function requestBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new GitPluginError('invalid-json', 'Request body must be JSON.') }
}

function string(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new GitPluginError('invalid-request', `${label} is required.`)
  return value.trim()
}

function settingsPath() { return join(homedir(), '.dsh', 'git-plugin-settings.json') }
async function readSettings() {
  try { return JSON.parse(await readFile(settingsPath(), 'utf8')) } catch (error) { if (error?.code === 'ENOENT') return { userName: '', userEmail: '', sshMode: 'managed', sshPath: null }; throw error }
}
async function saveSettings(next) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = settingsPath()
  await mkdir(resolve(path, '..'), { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  return next
}

function makeRoute(ctx, config) {
  const prefix = config.routePrefix ?? '/plugins/dsh-git'
  const credentialRef = config.credentialRef ?? 'DSH_GIT_SSH_PRIVATE_KEY'
  const keyDirectory = config.keyDirectory?.replace(/^~(?=$|\/)/, homedir()) ?? join(homedir(), '.dsh', 'git-keys')
  const keyFilename = config.managedKeyFilename ?? 'id_ed25519'
  const configuredRoot = config.workspaceRoot?.replace(/^~(?=$|\/)/, homedir()) ?? join(homedir(), 'workspace')

  const gitOptions = async () => {
    const settings = await readSettings()
    if (settings.sshMode === 'reference') return { env: sshEnvironment(settings.sshPath) }
    const credential = await ctx.credentials.resolve(credentialRef)
    if (credential === undefined) throw new GitPluginError('ssh-key-unconfigured', 'Configure an SSH key in Git settings before using remote Git operations.')
    const managed = await writeManagedKey({ privateKey: credential.value, publicKey: settings.publicKey ?? '', directory: keyDirectory, filename: keyFilename })
    return { env: sshEnvironment(managed.privatePath) }
  }

  return async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname.slice(prefix.length) || '/'
      if (req.method === 'GET' && path === '/settings') {
        const settings = await readSettings()
        const credential = await ctx.credentials.describe(credentialRef)
        return json(res, 200, { ok: true, value: { ...settings, managedKeyConfigured: credential.configured } })
      }
      const body = await requestBody(req)
      if (req.method === 'POST' && path === '/settings') {
        const settings = await saveSettings({
          userName: typeof body.userName === 'string' ? body.userName.trim() : '',
          userEmail: typeof body.userEmail === 'string' ? body.userEmail.trim() : '',
          sshMode: ['managed', 'reference'].includes(body.sshMode) ? body.sshMode : 'managed',
          sshPath: body.sshMode === 'reference' ? string(body.sshPath, 'SSH key path') : null,
          publicKey: typeof body.publicKey === 'string' ? body.publicKey : undefined,
        })
        return json(res, 200, { ok: true, value: settings })
      }
      if (req.method === 'POST' && path === '/ssh/generate') {
        const key = await generateSshKey({ directory: keyDirectory, filename: keyFilename, comment: 'DSH Git' })
        const content = await readExistingKey(key.privatePath)
        await ctx.credentials.set(credentialRef, content)
        const settings = await saveSettings({ ...(await readSettings()), sshMode: 'managed', sshPath: null, publicKey: key.publicKey })
        return json(res, 200, { ok: true, value: { publicKey: settings.publicKey } })
      }
      if (req.method === 'POST' && path === '/ssh/import') {
        const sourcePath = string(body.path, 'SSH key path')
        const content = await readExistingKey(sourcePath)
        await ctx.credentials.set(credentialRef, content)
        await saveSettings({ ...(await readSettings()), sshMode: 'managed', sshPath: null })
        return json(res, 200, { ok: true, value: { imported: true } })
      }
      if (req.method === 'POST' && path === '/clone') {
        const remote = assertSshUrl(string(body.url, 'Repository URL'))
        const destination = workspaceDestination(body.workspaceRoot ?? configuredRoot, string(body.name, 'Workspace name'))
        const target = await clone({ url: remote, destination, branch: body.branch }, await gitOptions())
        return json(res, 200, { ok: true, value: { path: target, title: repositoryTitle(target) } })
      }
      const workspace = string(body.workspace, 'Workspace path')
      const options = path === '/status' || path === '/diff' || path === '/branches' || path === '/history' ? {} : await gitOptions()
      if (req.method === 'POST' && path === '/status') return json(res, 200, { ok: true, value: await status(workspace, options) })
      if (req.method === 'POST' && path === '/diff') return json(res, 200, { ok: true, value: await diff(workspace, string(body.file, 'File'), Boolean(body.staged), options) })
      if (req.method === 'POST' && path === '/branches') return json(res, 200, { ok: true, value: await branches(workspace, options) })
      if (req.method === 'POST' && path === '/history') return json(res, 200, { ok: true, value: await history(workspace, body.limit, options) })
      if (req.method === 'POST' && path === '/stage') return json(res, 200, { ok: true, value: await stage(workspace, body.files, Boolean(body.staged), options) })
      if (req.method === 'POST' && path === '/checkout') return json(res, 200, { ok: true, value: await checkout(workspace, string(body.branch, 'Branch'), options) })
      if (req.method === 'POST' && path === '/commit') return json(res, 200, { ok: true, value: await commit(workspace, string(body.message, 'Commit message'), await readSettings(), options) })
      if (req.method === 'POST' && path === '/fetch') return json(res, 200, { ok: true, value: await fetch(workspace, options) })
      if (req.method === 'POST' && path === '/pull') return json(res, 200, { ok: true, value: await pullFastForward(workspace, options) })
      if (req.method === 'POST' && path === '/push') return json(res, 200, { ok: true, value: await push(workspace, options) })
      return json(res, 404, { ok: false, error: { code: 'not-found', message: 'Unknown Git endpoint.' } })
    } catch (error) {
      const known = error instanceof GitPluginError
      return json(res, known ? 400 : 500, { ok: false, error: { code: known ? error.code : 'internal', message: known ? error.message : 'Git operation failed.' } })
    }
  }
}

export function apply(ctx, config = {}) {
  const prefix = config.routePrefix ?? '/plugins/dsh-git'
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: prefix, handler: makeRoute(ctx, config) }), 'dsh-git: HTTP API')
}
