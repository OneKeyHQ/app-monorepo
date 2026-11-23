---
name: 1k-dev-commands
description: OneKey development commands plus branch, commit, validation, and PR conventions.
allowed-tools: Bash, Read
---

# OneKey Development Commands

For branch naming, commit format, rebasing, and PR conventions, read [git-workflow.md](references/git-workflow.md).

## Application Development Commands

**PLATFORM-SPECIFIC DEVELOPMENT**:

- `yarn app:desktop` - Start desktop Electron app development with Rspack
  - **Runtime**: 30-60 seconds to start
  - **Common issues**: Node version conflicts, missing native dependencies
  - **Troubleshooting**: Inspect startup logs first; use clean/reinstall only
    when evidence points to stale build artifacts or broken dependencies

- `yarn app:web:rspack` - Start web development server (port 3000)
  - **Runtime**: 15-30 seconds to start
  - **Common issues**: Port 3000 already in use, rspack compilation errors
  - **Troubleshooting**: Identify the process using port 3000 before stopping
    it; preserve unrelated sessions and check console errors

- `yarn app:ext` - Start browser extension development with Rspack
  - **Runtime**: 20-40 seconds to start
  - **Common issues**: Manifest v3 validation errors, permission issues
  - **Troubleshooting**: Check extension manifest validity, verify content security policy

- [Mobile DevSession launcher](references/mobile-dev-shell.md) - Default path
  for normal iOS/Android React Native development. Read this guide before
  starting the app, restoring shell/vendor resources, or attaching UI tooling.

- [Mobile dependency setup](references/mobile-dependencies.md) - CocoaPods,
  Pods installation, and missing injected assets.

- `yarn app:ios` - Start iOS development through the Mobile DevSession launcher
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Xcode setup, simulator issues, pod install failures
  - **Prerequisites**: Xcode installed, iOS simulator available

- `yarn app:android` - Start Android development through the Mobile DevSession launcher
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Android SDK path, emulator setup, gradle build failures
  - **Prerequisites**: Android Studio, SDK tools, emulator configured

- Direct local native builds: `yarn workspace @onekeyhq/mobile ios` and
  `yarn workspace @onekeyhq/mobile android`. Use them only when explicitly
  requested or when diagnosing the launcher.

- `yarn app:web-embed` - Start embeddable components development
  - **Runtime**: 15-30 seconds
  - **Usage**: For developing standalone wallet components

- `yarn app:native-bundle` - Prepare iOS/Android development vendor bundles,
  then start Metro. Wait for `Dev server ready`; this does not install the app.

## Build Commands

**PRODUCTION BUILDS** (Use for final validation):

- `yarn app:desktop:build` - Build desktop app for all platforms
  - **Runtime**: 5-10 minutes (multi-platform build)
  - **Output**: Platform-specific installers in `apps/desktop/dist/`
  - **Common issues**: Code signing, platform-specific dependencies
  - **Verification**: Test installers on target platforms

- `yarn app:ext:build` - Build browser extension
  - **Runtime**: 2-3 minutes
  - **Output**: Unpacked extension in `apps/ext/build/chrome_v3/`
  - **Common issues**: Manifest validation, content security policy violations
  - **Verification**: Load extension in browser for testing

- `yarn app:web:build` - Build web application
  - **Runtime**: 3-5 minutes
  - **Output**: Static files in `apps/web/dist/`
  - **Common issues**: Bundle size limits, missing environment variables
  - **Verification**: Serve built files and test functionality

## Development Tools & Quality Assurance

### Pre-commit Commands (Local Development)

**Use this for fast agent pre-commit validation:**

- `yarn agent:check --profile commit` - Runs worktree auto-fixes, staged lint,
  type checks, and repository checks with compact output. Matching modified and
  untracked JS/TS files may be changed by `oxlint --fix` and `oxfmt`; inspect the
  worktree first and preserve unrelated user changes.

**Pre-commit workflow:**

```bash
yarn agent:check --profile commit && git commit -m "your message"
```

### PR Readiness And Remote Status

- `yarn agent:check --profile pr` - Local checks and auto-fixes plus remote
  CI/review status. Use for implementation readiness, not read-only review.
- `yarn agent:check --profile ci --pr <number>` - Remote CI/review status without
  local auto-fixes; writes local logs.
- `yarn lint` - Full project check for CI. For agent validation use the profiles
  above; use lower-level lint/type commands to diagnose a failed gate.

- Do not run `yarn eslint`, `npx eslint`, or `node_modules/.bin/eslint`.
  ESLint entries are legacy compatibility remnants.

### Other Tools

- `yarn clean` - Clean all build artifacts and node_modules
- `yarn reinstall` - Full clean install (use when dependency issues occur)

## Testing

- Run the relevant package's test script or a focused Jest test with
  `yarn jest --runTestsByPath <test-file>`. Avoid the ambiguous root `yarn test`.
- Select tests by failure modes and acceptance criteria; passing lint/types
  alone does not establish runtime correctness.
- Jest configuration in `jest.config.js`
- Test setup in `jest-setup.js`
- Tests located in `@tests/` directories within packages
- Mobile tests use `jest-expo` preset
