import { spawn } from 'node:child_process'
import { access, constants, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

const SSH_URL = /^(?:git@[^:/]+:|ssh:\/\/[^/]+\/).+\.git\/?$/
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export class GitPluginError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function assertSshUrl(url) {
  if (typeof url !== 'string' || !SSH_URL.test(url.trim())) {
    throw new GitPluginError('ssh-url-required', 'Use an SSH repository URL, such as git@github.com:owner/repository.git.')
  }
  return url.trim()
}

export function assertWorkspaceName(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) {
    throw new GitPluginError('invalid-workspace-name', 'Workspace names may contain letters, numbers, dots, underscores, and hyphens.')
  }
  return name
}

export async function run(command, args, { cwd, env = {}, signal } = {}) {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolveResult({ code: code ?? 1, stdout, stderr }))
  })
}

function cleanError(stderr) {
  return stderr.replace(/(?:IdentityFile|key|passphrase|token|password)[^\n]*/gi, 'sensitive authentication detail redacted').trim()
}

export async function git(args, options = {}) {
  const result = await run('git', args, options)
  if (result.code !== 0) {
    throw new GitPluginError('git-failed', cleanError(result.stderr) || `git ${args[0]} failed`)
  }
  return result.stdout
}

export async function ensureRepository(path, options) {
  await git(['-C', path, 'rev-parse', '--is-inside-work-tree'], options)
  return resolve(path)
}

export async function status(path, options) {
  await ensureRepository(path, options)
  const [branch, porcelain, upstream] = await Promise.all([
    git(['-C', path, 'branch', '--show-current'], options),
    git(['-C', path, 'status', '--porcelain=v1', '-uall'], options),
    run('git', ['-C', path, 'rev-parse', '--abbrev-ref', '@{upstream}'], options),
  ])
  const files = porcelain.split('\n').filter(Boolean).map(line => ({
    staged: line.slice(0, 1).trim() || null,
    unstaged: line.slice(1, 2).trim() || null,
    path: line.slice(3),
  }))
  let ahead = 0
  let behind = 0
  if (upstream.code === 0) {
    const counts = await git(['-C', path, 'rev-list', '--left-right', '--count', '@{upstream}...HEAD'], options)
    const [behindText, aheadText] = counts.trim().split(/\s+/)
    behind = Number(behindText) || 0
    ahead = Number(aheadText) || 0
  }
  return { branch: branch.trim() || null, upstream: upstream.code === 0 ? upstream.stdout.trim() : null, ahead, behind, clean: files.length === 0, files }
}

export async function diff(path, file, staged, options) {
  await ensureRepository(path, options)
  if (typeof file !== 'string' || file.length === 0 || file.includes('\0')) throw new GitPluginError('invalid-path', 'Choose a changed file.')
  const args = ['-C', path, 'diff', '--no-ext-diff', '--unified=3']
  if (staged) args.push('--cached')
  args.push('--', file)
  return { path: file, staged: Boolean(staged), diff: await git(args, options) }
}

export async function branches(path, options) {
  await ensureRepository(path, options)
  const text = await git(['-C', path, 'for-each-ref', '--format=%(refname:short)\t%(HEAD)\t%(upstream:short)', 'refs/heads', 'refs/remotes'], options)
  return text.split('\n').filter(Boolean).map(line => {
    const [name, current, upstream] = line.split('\t')
    return { name, current: current === '*', upstream: upstream || null, remote: name.startsWith('origin/') }
  })
}

export async function history(path, limit = 50, options) {
  await ensureRepository(path, options)
  const bounded = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const text = await git(['-C', path, 'log', `-n${bounded}`, '--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s'], options)
  return text.split('\n').filter(Boolean).map(row => {
    const [id, shortId, author, email, date, subject] = row.split('\x1f')
    return { id, shortId, author, email, date, subject }
  })
}

export async function stage(path, files, staged, options) {
  await ensureRepository(path, options)
  if (!Array.isArray(files) || files.length === 0) throw new GitPluginError('files-required', 'Select at least one file.')
  await git(['-C', path, staged ? 'add' : 'restore', staged ? '--' : '--staged', ...files], options)
  return await status(path, options)
}

export async function commit(path, message, identity, options) {
  await ensureRepository(path, options)
  if (typeof message !== 'string' || message.trim().length === 0) throw new GitPluginError('message-required', 'Enter a commit message.')
  if (!identity?.name?.trim() || !identity?.email?.trim()) throw new GitPluginError('identity-required', 'Set Git user.name and user.email in Git settings first.')
  await git(['-C', path, '-c', `user.name=${identity.name.trim()}`, '-c', `user.email=${identity.email.trim()}`, 'commit', '-m', message.trim()], options)
  return await status(path, options)
}

export async function checkout(path, branch, options) {
  await ensureRepository(path, options)
  if (typeof branch !== 'string' || branch.length === 0 || branch.startsWith('-')) throw new GitPluginError('invalid-branch', 'Choose a valid branch.')
  await git(['-C', path, 'switch', '--', branch], options)
  return await status(path, options)
}

export async function fetch(path, options) { await ensureRepository(path, options); await git(['-C', path, 'fetch', '--prune'], options); return await status(path, options) }
export async function pullFastForward(path, options) { await ensureRepository(path, options); await git(['-C', path, 'pull', '--ff-only'], options); return await status(path, options) }
export async function push(path, options) { await ensureRepository(path, options); await git(['-C', path, 'push'], options); return await status(path, options) }

export async function clone({ url, destination, branch }, options) {
  const remote = assertSshUrl(url)
  const target = resolve(destination)
  try { await access(target, constants.F_OK); throw new GitPluginError('destination-exists', 'The destination already exists. Choose a new empty workspace name.') } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(dirname(target), { recursive: true })
  const args = ['clone']
  if (branch?.trim()) args.push('--branch', branch.trim())
  args.push('--', remote, target)
  await git(args, options)
  return target
}

export function workspaceDestination(root, name) {
  assertWorkspaceName(name)
  const target = resolve(root, name)
  if (!target.startsWith(`${resolve(root)}${process.platform === 'win32' ? '\\' : '/'}`)) throw new GitPluginError('invalid-destination', 'Workspace destination escapes the configured workspace root.')
  return target
}

export async function writeManagedKey({ privateKey, publicKey, directory, filename }) {
  const dir = resolve(directory ?? join(homedir(), '.dsh', 'git-keys'))
  const base = filename ?? 'id_ed25519'
  if (!SAFE_NAME.test(base)) throw new GitPluginError('invalid-key-name', 'Use a safe SSH key file name.')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const privatePath = join(dir, base)
  await writeFile(privatePath, privateKey, { encoding: 'utf8', mode: 0o600 })
  await writeFile(`${privatePath}.pub`, publicKey, { encoding: 'utf8', mode: 0o644 })
  return { privatePath, publicKey }
}

export async function readExistingKey(path) {
  const absolute = resolve(path)
  const info = await stat(absolute)
  if (!info.isFile()) throw new GitPluginError('invalid-key-path', 'The SSH key path must reference a file.')
  return await readFile(absolute, 'utf8')
}

export async function generateSshKey({ directory, filename, comment }, options) {
  const dir = resolve(directory ?? join(homedir(), '.dsh', 'git-keys'))
  const base = filename ?? 'id_ed25519'
  if (!SAFE_NAME.test(base)) throw new GitPluginError('invalid-key-name', 'Use a safe SSH key file name.')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const privatePath = join(dir, base)
  const result = await run('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', comment ?? 'DSH Git', '-f', privatePath], options)
  if (result.code !== 0) throw new GitPluginError('ssh-keygen-failed', cleanError(result.stderr) || 'SSH key generation failed.')
  return { privatePath, publicKey: await readFile(`${privatePath}.pub`, 'utf8') }
}

export function sshEnvironment(keyPath) {
  if (!isAbsolute(keyPath)) throw new GitPluginError('invalid-key-path', 'SSH key paths must be absolute.')
  return { GIT_SSH_COMMAND: `ssh -i ${JSON.stringify(normalize(keyPath))} -o IdentitiesOnly=yes` }
}

export function repositoryTitle(path) { return basename(resolve(path)) }
