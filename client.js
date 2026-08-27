import { createElement, useEffect, useState } from 'react'

export const name = 'dsh-git-workspace-client'
export const inject = ['slots', 'workspaces']

const api = '/plugins/dsh-git'
async function call(path, body = {}) {
  const response = await fetch(`${api}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function Action({ children, onClick, disabled = false }) {
  return createElement('button', { type: 'button', disabled, onClick, style: { border: '1px solid #475569', borderRadius: 6, padding: '6px 9px', color: '#f8fafc', background: '#1e293b', cursor: disabled ? 'not-allowed' : 'pointer' } }, children)
}

function GitPanel({ workspace, onClose }) {
  const [tab, setTab] = useState('status')
  const [state, setState] = useState(null)
  const [history, setHistory] = useState([])
  const [branchList, setBranchList] = useState([])
  const [diff, setDiff] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const refresh = async () => {
    try {
      setError('')
      const value = await call('/status', { workspace: workspace.path })
      setState(value)
      if (tab === 'history') setHistory(await call('/history', { workspace: workspace.path }))
      if (tab === 'branches') setBranchList(await call('/branches', { workspace: workspace.path }))
    } catch (reason) { setError(reason.message) }
  }
  useEffect(() => { void refresh() }, [workspace.path, tab])
  const mutation = async (endpoint, body = {}) => {
    if (!window.confirm(`Confirm Git ${endpoint.slice(1)} for ${workspace.title}.`)) return
    try { await call(endpoint, { workspace: workspace.path, ...body }); await refresh() } catch (reason) { setError(reason.message) }
  }
  const style = { position: 'fixed', top: 0, right: 0, width: 'min(420px, 100vw)', height: '100vh', overflow: 'auto', padding: 16, boxSizing: 'border-box', color: '#e2e8f0', background: '#0f172a', borderLeft: '1px solid #334155', pointerEvents: 'auto', zIndex: 30, fontFamily: 'system-ui, sans-serif' }
  const tabs = ['status', 'changes', 'commit', 'branches', 'history', 'sync']
  return createElement('aside', { style, 'aria-label': 'Git sidebar' },
    createElement('header', { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } }, createElement('strong', null, `Git · ${workspace.title}`), createElement(Action, { onClick: onClose }, 'Close')),
    createElement('nav', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, margin: '12px 0' } }, ...tabs.map(item => createElement(Action, { key: item, onClick: () => setTab(item), disabled: tab === item }, item[0].toUpperCase() + item.slice(1)))),
    error && createElement('p', { role: 'alert', style: { color: '#fca5a5' } }, error),
    tab === 'status' && createElement('section', null,
      createElement('p', null, state ? `Branch: ${state.branch ?? 'detached'} · ${state.clean ? 'Clean' : `${state.files.length} changed files`}` : 'Loading…'),
      state && createElement('p', null, `Upstream: ${state.upstream ?? 'none'} · ↑${state.ahead} ↓${state.behind}`),
      createElement(Action, { onClick: refresh }, 'Refresh')),
    tab === 'changes' && createElement('section', null,
      createElement('h3', null, 'Changes'),
      ...(state?.files ?? []).map(file => createElement('div', { key: `${file.staged}:${file.unstaged}:${file.path}`, style: { padding: '8px 0', borderBottom: '1px solid #334155' } },
        createElement('div', null, `${file.staged ?? ' '} ${file.unstaged ?? ' '} ${file.path}`),
        createElement('div', { style: { display: 'flex', gap: 4, marginTop: 4 } },
          createElement(Action, { onClick: async () => { try { setDiff((await call('/diff', { workspace: workspace.path, file: file.path, staged: false })).diff) } catch (e) { setError(e.message) } } }, 'View diff'),
          createElement(Action, { onClick: () => mutation('/stage', { files: [file.path], staged: true }) }, 'Stage'),
          createElement(Action, { onClick: () => mutation('/stage', { files: [file.path], staged: false }) }, 'Unstage')))),
      diff && createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: 12, color: '#cbd5e1' } }, diff)),
    tab === 'commit' && createElement('section', null,
      createElement('h3', null, 'Commit staged changes'),
      createElement('textarea', { value: message, onChange: e => setMessage(e.target.value), placeholder: 'Commit message', style: { width: '100%', minHeight: 90, boxSizing: 'border-box' } }),
      createElement('p', null, createElement(Action, { disabled: !message.trim(), onClick: () => mutation('/commit', { message }) }, 'Commit'))),
    tab === 'branches' && createElement('section', null, createElement('h3', null, 'Branches'), ...branchList.map(branch => createElement('p', { key: branch.name }, createElement(Action, { disabled: branch.current, onClick: () => mutation('/checkout', { branch: branch.name }) }, branch.current ? `● ${branch.name}` : branch.name)))),
    tab === 'history' && createElement('section', null, createElement('h3', null, 'History'), ...history.map(item => createElement('p', { key: item.id }, createElement('code', null, item.shortId), ` ${item.subject}`))),
    tab === 'sync' && createElement('section', null, createElement('h3', null, 'Sync'), createElement('p', null, 'Pull uses fast-forward only. Diverged branches require manual resolution.'), createElement('div', { style: { display: 'flex', gap: 6 } }, createElement(Action, { onClick: () => mutation('/fetch') }, 'Fetch'), createElement(Action, { onClick: () => mutation('/pull') }, 'Pull (FF only)'), createElement(Action, { onClick: () => mutation('/push') }, 'Push'))),
  )
}

function CloneDialog({ onClose, onCloned }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [branch, setBranch] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    if (!window.confirm(`Clone ${url} into new workspace ${name}?`)) return
    try { const value = await call('/clone', { url, name, branch: branch || undefined }); onCloned(value); onClose() } catch (reason) { setError(reason.message) }
  }
  return createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 31, pointerEvents: 'auto', display: 'grid', placeItems: 'center' } },
    createElement('div', { role: 'dialog', 'aria-label': 'Clone Git repository', style: { width: 'min(460px, 90vw)', background: '#0f172a', color: '#e2e8f0', padding: 20, borderRadius: 8 } },
      createElement('h2', null, 'Clone Git repository'), error && createElement('p', { role: 'alert', style: { color: '#fca5a5' } }, error),
      createElement('label', null, 'SSH repository URL', createElement('input', { value: url, onChange: e => setUrl(e.target.value), placeholder: 'git@github.com:owner/repository.git', style: { display: 'block', width: '100%' } })),
      createElement('label', null, 'Workspace name', createElement('input', { value: name, onChange: e => setName(e.target.value), style: { display: 'block', width: '100%' } })),
      createElement('label', null, 'Branch (optional)', createElement('input', { value: branch, onChange: e => setBranch(e.target.value), style: { display: 'block', width: '100%' } })),
      createElement('p', { style: { display: 'flex', gap: 6 } }, createElement(Action, { onClick: onClose }, 'Cancel'), createElement(Action, { disabled: !url || !name, onClick: submit }, 'Clone'))))
}

function GitSettings() {
  const [settings, setSettings] = useState({ userName: '', userEmail: '', sshMode: 'managed', sshPath: '' })
  const [publicKey, setPublicKey] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { fetch(`${api}/settings`).then(r => r.json()).then(r => r.ok && setSettings(r.value)).catch(() => {}) }, [])
  const save = async () => { try { await call('/settings', settings) } catch (e) { setError(e.message) } }
  const generate = async () => { try { const value = await call('/ssh/generate'); setPublicKey(value.publicKey) } catch (e) { setError(e.message) } }
  const importKey = async () => { try { await call('/ssh/import', { path: settings.sshPath }); setSettings({ ...settings, sshMode: 'managed' }) } catch (e) { setError(e.message) } }
  return createElement('section', null, createElement('h2', null, 'Git settings'), error && createElement('p', { role: 'alert' }, error),
    createElement('label', null, 'Git user.name', createElement('input', { value: settings.userName, onChange: e => setSettings({ ...settings, userName: e.target.value }) })),
    createElement('label', null, 'Git user.email', createElement('input', { value: settings.userEmail, onChange: e => setSettings({ ...settings, userEmail: e.target.value }) })),
    createElement('h3', null, 'SSH key'),
    createElement('label', null, createElement('input', { type: 'radio', checked: settings.sshMode === 'managed', onChange: () => setSettings({ ...settings, sshMode: 'managed' }) }), ' Use DSH-managed key'),
    createElement('label', null, createElement('input', { type: 'radio', checked: settings.sshMode === 'reference', onChange: () => setSettings({ ...settings, sshMode: 'reference' }) }), ' Use existing ~/.ssh key'),
    createElement('input', { value: settings.sshPath ?? '', onChange: e => setSettings({ ...settings, sshPath: e.target.value }), placeholder: '/home/user/.ssh/id_ed25519' }),
    createElement('p', null, createElement(Action, { onClick: generate }, 'Generate managed key'), ' ', createElement(Action, { onClick: importKey }, 'Import existing key'), ' ', createElement(Action, { onClick: save }, 'Save settings')),
    publicKey && createElement('pre', { style: { whiteSpace: 'pre-wrap' } }, publicKey))
}

export function apply(ctx) {
  let openPanel = null
  const currentWorkspace = () => {
    const snapshot = ctx.workspaces.list?.getSnapshot?.() ?? ctx.workspaces.getSnapshot?.()
    const items = snapshot?.items ?? []
    const recent = snapshot?.recentWorkspaceId
    return items.find(item => item.workspaceId === recent) ?? items[0] ?? null
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-git-panel', order: 100 }, () => {
    const [workspace, setWorkspace] = useState(openPanel)
    const [cloneOpen, setCloneOpen] = useState(false)
    useEffect(() => { const timer = window.setInterval(() => { if (workspace !== openPanel) setWorkspace(openPanel) }, 200); return () => window.clearInterval(timer) }, [workspace])
    return createElement('div', { style: { pointerEvents: 'none' } },
      createElement('div', { style: { position: 'fixed', right: 20, bottom: 20, display: 'flex', gap: 8, pointerEvents: 'auto', zIndex: 29 } },
        createElement(Action, { onClick: () => setCloneOpen(true) }, 'Clone repository'),
        createElement(Action, { onClick: () => { openPanel = currentWorkspace(); setWorkspace(openPanel) }, disabled: currentWorkspace() === null }, 'Git')),
      workspace ? createElement(GitPanel, { workspace, onClose: () => { openPanel = null; setWorkspace(null) } }) : null,
      cloneOpen ? createElement(CloneDialog, { onClose: () => setCloneOpen(false), onCloned: () => {} }) : null,
    )
  }))
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'git', order: 70, label: 'Git' }, GitSettings))
}
