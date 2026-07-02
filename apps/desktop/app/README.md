# Desktop app package

This directory is the Electron application directory (`appDir`) for
`apps/desktop`.

Electron Builder uses the two-package structure here:

- `apps/desktop/package.json` is the development/workspace package. It owns
  build scripts and build-time dependencies.
- `apps/desktop/app/package.json` is the packaged Electron app manifest. Runtime
  dependencies that must be available to bare `require(...)` calls in
  `app/dist/app.js` belong here.
- `apps/desktop/app/yarn.lock` and this manifest participate in
  `electron-builder install-app-deps`; the command runs dependency installation
  with this directory as the app directory.

Official sources:

- Electron Builder two-package structure:
  https://www.electron.build/docs/tutorials/two-package-structure
- Electron Builder application contents and `files` behavior:
  https://www.electron.build/docs/contents
- Electron Builder configuration reference for `files` and app directory:
  https://www.electron.build/docs/configuration

Packaging notes:

- `electron-builder` detects this directory as `appDir` because it contains
  `package.json`.
- `files` patterns such as `baseFiles` are relative to this directory, not to
  `apps/desktop`.
- `package.json` and production `node_modules` are handled by Electron Builder
  as app contents. They are not omitted just because `baseFiles` only lists
  `dist/**/*`, `build/**/*`, and `package.json`.
- If a module is listed as `external` in `apps/desktop/scripts/build.js` and is
  required at runtime, add it to this package's `dependencies`.
- This README is source documentation only. It is explicitly excluded by
  `apps/desktop/electron-builder-files.config.js`.

Security scanner caveat:

Root-level dependency scanners may still report versions from the monorepo root
`yarn.lock`. That does not by itself describe the dependencies installed into
the packaged desktop app from this app directory.
