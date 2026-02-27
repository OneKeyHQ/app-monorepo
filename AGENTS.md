# AGENTS.md

## Cursor Cloud specific instructions

### Environment prerequisites
- **Node.js >= 22** (v22.22.0 works). The VM ships with nvm; no version switching needed.
- **Yarn 4.12.0** is bundled in `.yarn/releases/`; do not install Yarn globally.
- **`rsync`** must be available (needed by the web-embed postbuild script during `yarn install`). Install with `sudo apt-get install -y rsync` if missing.

### Dependency installation
- Run `yarn install` from the repo root. This automatically triggers `postinstall` which: creates `.env` from `.env.example`, applies 55 patch-package patches, copies injected provider files, and builds web-embed.
- Peer dependency warnings during install are expected and harmless.

### Running services
- **Web app** (easiest for headless VM): `yarn app:web` — starts webpack-dev-server on port 3000. First build takes ~2.5 minutes; subsequent hot reloads are fast.
- **Desktop app**: `yarn app:desktop` — requires a display (Electron). Not practical on headless Cloud VMs without Xvfb.
- **Extension**: `yarn app:ext` — builds to `apps/ext/build-v3/`, load as unpacked extension.
- **Mobile**: `yarn app:ios` / `yarn app:android` — requires Xcode/Android SDK; not available in Cloud VMs.
- No local databases or backend services required; all APIs are remote.

### Quality checks (see `CLAUDE.md` and `.codex/AGENTS.md` for full details)
- **Lint**: `yarn lint:staged` (oxlint on staged files) or `yarn lint:only` (full repo).
- **Type check**: `yarn tsc:staged` or `yarn tsc:only`.
- **Tests**: `yarn test` (Jest, ~2.5 minutes, 54 suites / 1261 tests).

### GPG commit signing
- A GPG key (`RSA 4096`, `Cursor Agent <cursoragent@cursor.com>`) is configured for commit signing.
- `commit.gpgsign=true` and `tag.gpgsign=true` are set globally.
- If GPG signing fails with "no tty", ensure `export GPG_TTY=$(tty)` is set in the shell.

### Gotchas discovered during setup
- The postinstall script builds web-embed which requires `rsync` to copy artifacts to the Android assets directory. Without `rsync`, `yarn install` exits with code 1 even though all other steps succeed.
- The first `yarn app:web` webpack build compiles with many duplicate-package warnings. These are expected and do not affect functionality.
- `.env` values (Sentry DSN, API keys, etc.) are all optional for local development; the app works without them.
