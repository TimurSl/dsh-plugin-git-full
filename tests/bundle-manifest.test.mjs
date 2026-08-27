import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

test('bundle resolves the host plugin from the profile-installed package path', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const patch = await readFile(join(root, manifest.dsh.bundle.patch), 'utf8')

  assert.equal(manifest.name, 'dsh-git-workspace-plugin')
  assert.match(patch, /^\s+name: \.\/node_modules\/dsh-git-workspace-plugin\/index\.js$/m)
  assert.doesNotMatch(patch, /^\s+name: \.\/index\.js$/m)
})
