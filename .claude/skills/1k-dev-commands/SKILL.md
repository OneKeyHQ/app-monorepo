---
name: 1k-dev-commands
description: Development commands — yarn scripts for dev servers, building, linting, testing, and troubleshooting.
allowed-tools: Bash, Read
---

# OneKey Development Commands

## Application Development Commands

**PLATFORM-SPECIFIC DEVELOPMENT**:
- `yarn app:desktop` - Start desktop Electron app development
  - **Runtime**: 30-60 seconds to start
  - **Common issues**: Node version conflicts, missing native dependencies
  - **Troubleshooting**: Run `yarn clean && yarn reinstall` if startup fails

- `yarn app:web` - Start web development server (port 3000)
  - **Runtime**: 15-30 seconds to start
  - **Common issues**: Port 3000 already in use, webpack compilation errors
  - **Troubleshooting**: Kill existing processes on port 3000, check console for specific errors

- `yarn app:ext` - Start browser extension development
  - **Runtime**: 20-40 seconds to start
  - **Common issues**: Manifest v3 validation errors, permission issues
  - **Troubleshooting**: Check extension manifest validity, verify content security policy

- `yarn app:ios` - Start iOS mobile development
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Xcode setup, simulator issues, pod install failures
  - **Prerequisites**: Xcode installed, iOS simulator available

- `yarn app:android` - Start Android mobile development
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Android SDK path, emulator setup, gradle build failures
  - **Prerequisites**: Android Studio, SDK tools, emulator configured

- `yarn app:web-embed` - Start embeddable components development
  - **Runtime**: 15-30 seconds
  - **Usage**: For developing standalone wallet components

## Build Commands

**PRODUCTION BUILDS** (Use for final validation):
- `yarn app:desktop:build` - Build desktop app for all platforms
  - **Runtime**: 5-10 minutes (multi-platform build)
  - **Output**: Platform-specific installers in `apps/desktop/dist/`
  - **Common issues**: Code signing, platform-specific dependencies
  - **Verification**: Test installers on target platforms

- `yarn app:ext:build` - Build browser extension
  - **Runtime**: 2-3 minutes
  - **Output**: Extension packages in `apps/ext/dist/`
  - **Common issues**: Manifest validation, content security policy violations
  - **Verification**: Load extension in browser for testing

- `yarn app:web:build` - Build web application
  - **Runtime**: 3-5 minutes
  - **Output**: Static files in `apps/web/dist/`
  - **Common issues**: Bundle size limits, missing environment variables
  - **Verification**: Serve built files and test functionality

- `yarn app:native-bundle` - Bundle React Native app
  - **Runtime**: 3-5 minutes
  - **Output**: Platform-specific bundles
  - **Common issues**: Native module linking, Metro bundler errors
  - **Prerequisites**: Platform development environment properly configured

## Development Tools & Quality Assurance

### Pre-commit Commands (Local Development)

**Use these for fast pre-commit validation:**
- `yarn lint:staged` - Lint only staged files (fast, recommended for pre-commit)
- `yarn tsc:staged` - Type check (same as tsc:only)

**Pre-commit workflow:**
```bash
yarn lint:staged && yarn tsc:staged && git commit -m "your message"
```

### CI Commands (Full Project Check)

**These run in CI pipeline or for comprehensive validation:**
- `yarn lint` - Comprehensive linting (TypeScript, ESLint, folder structure, i18n)
  - **Expected runtime**: ~1 minute
  - **Zero tolerance**: ALL warnings and errors MUST be fixed
  - **Use case**: CI pipeline and comprehensive pre-PR checks
- `yarn test` - Jest test execution
  - **Use case**: CI pipeline and test validation

### Other Tools

- `yarn clean` - Clean all build artifacts and node_modules
- `yarn reinstall` - Full clean install (use when dependency issues occur)

## Testing

- Jest configuration in `jest.config.js`
- Test setup in `jest-setup.js`
- Tests located in `@tests/` directories within packages
- Mobile tests use `jest-expo` preset
