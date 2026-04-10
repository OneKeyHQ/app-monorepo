# Build Guide

This guide is for contributors who want to understand how the OneKey monorepo is laid out, how dependencies are installed, and how to build only the targets they care about.

## Prerequisites

- Node.js `>= 22`
- Yarn `4.12.0` via Corepack
- Git LFS
- iOS work: Xcode `>= 13.3`
- Android work: JDK `>= 11`

The repository is configured with:

- `packageManager: "yarn@4.12.0"` in [`package.json`](package.json)
- `nodeLinker: node-modules` in [`.yarnrc.yml`](.yarnrc.yml)
- a local Yarn binary in [`.yarn/releases/`](.yarn/releases/)

## First Install

```bash
git clone https://github.com/OneKeyHQ/app-monorepo.git
cd app-monorepo
corepack enable
yarn
```

`yarn` does more than download packages. The root `postinstall` runs:

1. `yarn setup:env`
2. `patch-package`
3. `yarn copy:inject`

Those steps are defined in [`development/scripts/postinstall.js`](development/scripts/postinstall.js), so a fresh checkout is not fully prepared until the root install completes.

## Repository Layout

The repository is a Yarn workspace monorepo with two main top-level groups:

- `apps/*`: runnable products such as desktop, mobile, web, and the browser extension
- `packages/*`: shared logic, UI, background services, and SDK-style building blocks used by those apps

The most important directories for contributors are:

- `apps/desktop`: Electron desktop app
- `apps/ext`: browser extension
- `apps/mobile`: React Native app
- `apps/web`: web app
- `packages/components`: shared UI components
- `packages/core`: protocol and chain-specific logic
- `packages/kit`: reusable application UI flows
- `packages/kit-bg`: background services
- `packages/shared`: shared utilities, constants, and types
- `development`: build, lint, and packaging scripts

## Building Only What You Need

All commands below are intended to run from the repository root unless noted otherwise.

### Development entry points

- `yarn app:web`
- `yarn app:desktop`
- `yarn app:ext`
- `yarn app:ios`
- `yarn app:android`

These are thin wrappers around workspace-local scripts in the relevant app package.

### Browser extension only

Build the unpacked Manifest V3 extension:

```bash
yarn app:ext:build
```

This delegates to `yarn workspace @onekeyhq/ext build:v3`, which sets `EXT_MANIFEST_V3=1` and runs the extension webpack build.

If you also want zip archives, use:

```bash
yarn app:ext:build:all
```

That path runs the build and then executes [`development/webpack/ext/zip.js`](development/webpack/ext/zip.js) to create distributable archives.

### Desktop only

Start desktop development:

```bash
yarn app:desktop
```

Build the standard desktop package flow:

```bash
yarn app:desktop:build
```

That delegates to `yarn workspace @onekeyhq/desktop build`, which performs:

1. clean build artifacts
2. build the renderer bundle
3. build the Electron main process
4. run `electron-builder install-app-deps`
5. package the desktop app with Electron Builder

For Linux-targeted packaging, the desktop workspace also exposes:

```bash
yarn workspace @onekeyhq/desktop build:snap
```

For renderer-only work, you can use:

```bash
yarn app:desktop:web
```

## Dependency Model

The repository uses Yarn workspaces:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Most app packages depend on internal workspaces such as `@onekeyhq/components`, `@onekeyhq/kit`, and `@onekeyhq/shared`. That means dependency installation is centralized at the repo root rather than per app.

To add a dependency to a single workspace, use a workspace-scoped command such as:

```bash
yarn workspace @onekeyhq/web add axios
```

This keeps dependency ownership attached to the intended package instead of the monorepo root.

## Offline And Repeatable Builds

The lockfile is [`yarn.lock`](yarn.lock), and Yarn is configured to use the `node-modules` linker. The repository does not currently check in a populated `.yarn/cache`, so a completely offline first install is not available out of the box.

If you need an offline or air-gapped build flow, prepare it ahead of time by:

1. running `yarn` on a connected machine
2. preserving the generated Yarn cache and `node_modules`
3. reusing the same lockfile and Yarn version (`4.12.0`)
4. mirroring any Git LFS assets required by your target workflow

In practice, `yarn.lock` gives you version pinning, but reproducible offline setup still depends on prefetching the package artifacts first.

## Why These Helper Tools Exist

### `rimraf`

The app workspaces use `rimraf` in their clean scripts instead of raw `rm -rf` so the same cleanup commands work across shells and operating systems, including Windows contributors.

### `cross-env`

Many scripts set flags such as `NODE_ENV`, `EXT_MANIFEST_V3`, or `NODE_OPTIONS`. `cross-env` makes those environment-variable assignments behave consistently across macOS, Linux, and Windows shells.

### `development/webpack/ext/zip.js`

The extension packaging flow needs more than a plain zip step. The script creates archive outputs, adds development-build assets, and rewrites manifest metadata for the development zip variants. That is why the repo uses a Node wrapper instead of only calling `zip` directly from package scripts.

One caveat from the current script: it still contains a TODO noting that some shell commands inside it do not work on Windows.

## Notes For Subset Builds

- If you only care about the extension, you can ignore Electron-specific packaging and mobile setup.
- If you only care about desktop, you can focus on the root install plus the `@onekeyhq/desktop` scripts.
- If you are working on iOS after the root install, you will still need the CocoaPods step exposed as `yarn app:ios:pod-install`.

## Related Files

- [`README.md`](README.md)
- [`package.json`](package.json)
- [`.yarnrc.yml`](.yarnrc.yml)
- [`apps/ext/package.json`](apps/ext/package.json)
- [`apps/desktop/package.json`](apps/desktop/package.json)
- [`development/webpack/ext/zip.js`](development/webpack/ext/zip.js)
