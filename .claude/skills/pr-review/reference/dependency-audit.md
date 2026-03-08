# Dependency audit notes

## Suggested commands
- Show dependency diffs:
  - git diff -- package.json
  - git diff -- yarn.lock pnpm-lock.yaml package-lock.json
- Inspect package metadata:
  - npm view <pkg> version time maintainers repository dist.tarball
- Locate entrypoints:
  - cat node_modules/<pkg>/package.json

## Grep patterns (starting points)
- Outbound / telemetry:
  - fetch\(|axios|XMLHttpRequest|http\.request|https\.request|new WebSocket|ws|request\(|net\.|dns\.
- Dynamic execution:
  - eval\(|new Function|vm\.runIn|Function\(|child_process|spawn\(|exec\(
- Install hooks / binaries:
  - postinstall|preinstall|install|node-pre-gyp|prebuild|download|curl|wget
