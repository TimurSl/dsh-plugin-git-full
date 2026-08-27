import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertSshUrl, assertWorkspaceName, GitPluginError, status, workspaceDestination } from '../git-core.js'

test('accepts SSH Git URLs and rejects HTTPS URLs', () => {
  assert.equal(assertSshUrl('git@github.com:owner/repo.git'), 'git@github.com:owner/repo.git')
  assert.throws(() => assertSshUrl('https://github.com/owner/repo.git'), GitPluginError)
})

test('restricts workspace names and destination traversal', () => {
  assert.equal(assertWorkspaceName('project_1'), 'project_1')
  assert.throws(() => assertWorkspaceName('../escape'), GitPluginError)
  assert.throws(() => workspaceDestination('/tmp/root', '../escape'), GitPluginError)
})

test('reads Git status including staged and unstaged file state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-test-'))
  const { run } = await import('../git-core.js')
  await run('git', ['init', root])
  await run('git', ['-C', root, 'config', 'user.name', 'Test User'])
  await run('git', ['-C', root, 'config', 'user.email', 'test@example.invalid'])
  await writeFile(join(root, 'note.txt'), 'one\n')
  await run('git', ['-C', root, 'add', 'note.txt'])
  await run('git', ['-C', root, 'commit', '-m', 'initial'])
  await writeFile(join(root, 'note.txt'), 'two\n')
  const value = await status(root)
  assert.equal(value.clean, false)
  assert.deepEqual(value.files, [{ staged: null, unstaged: 'M', path: 'note.txt' }])
  assert.equal(await readFile(join(root, 'note.txt'), 'utf8'), 'two\n')
})
