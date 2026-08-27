# DSH Git Workspace Plugin

An English DSH Web plugin that adds floating **Clone repository** and **Git** controls. It is intended to be installed from a Git repository into a DSH Web profile.

## Features

- SSH-only cloning into a newly named workspace directory.
- A floating Git control that opens an active-workspace right sidebar.
- Status, staged/unstaged file changes, unified diffs, staging, commits, branch switching, history, fetch, fast-forward-only pull, and push.
- Git settings for `user.name`, `user.email`, and SSH keys.
- SSH setup modes: generate a DSH-managed key, import and store an existing key, or reference a user `~/.ssh` key in place.
- Read-only inspection is immediate; clone, stage/unstage, branch switching, commit, pull, and push require an explicit browser confirmation.

## Install from Git

The package includes a `prepare` hook because DSH Git installs build the browser client artifact. Allow the build in your NixOS/DSH configuration, then add it to the Web profile using your Git source URL.

Example package source:

```text
git+https://github.com/YOUR-ORG/dsh-git-workspace-plugin.git
```

The plugin bundle manifest is in `cordis.patch.yml`. Its default route is `/plugins/dsh-git` and it uses the DSH credential reference `DSH_GIT_SSH_PRIVATE_KEY` for managed and imported keys.

## Security behavior

- Only SSH Git remotes are accepted. HTTPS URLs, tokens, and passwords are not supported.
- Managed/imported private key material is saved through the DSH credentials provider; it is not displayed in the Web UI or recorded in Git operation errors.
- Referenced `~/.ssh` keys are never copied or modified.
- Git host verification remains OpenSSH-controlled. The plugin does not disable host-key checks.
- Pull always invokes `git pull --ff-only`; diverged branches stop without a merge commit or conflict UI.
- Push never force-pushes.

## Development

```sh
pnpm install
pnpm run build
pnpm run check
pnpm test
```

`pnpm run build` emits `client.cjs`, the browser artifact DSH loads through the package `./client` export.

## Deferred work

HTTPS authentication, branch creation/deletion, tags, stashes, merge/rebase, conflict resolution, cherry-pick, and force push are intentionally excluded.
