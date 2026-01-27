---
name: 1k-dev-commands
description: Development commands for OneKey monorepo. Use when running dev servers, building apps, linting, testing, or troubleshooting build issues. Triggers on bun run, dev, build, lint, test, desktop, mobile, web, extension, ios, android, compile, bundle.
allowed-tools: Bash, Read
---

# OneKey Development Commands

## Application Development Commands

**PLATFORM-SPECIFIC DEVELOPMENT**:
- `bun run app:desktop` - Start desktop Electron app development
  - **Runtime**: 30-60 seconds to start
  - **Common issues**: Node version conflicts, missing native dependencies
  - **Troubleshooting**: Run `bun run clean && bun run reinstall` if startup fails

- `bun run app:web` - Start web development server (port 3000)
  - **Runtime**: 15-30 seconds to start
  - **Common issues**: Port 3000 already in use, webpack compilation errors
  - **Troubleshooting**: Kill existing processes on port 3000, check console for specific errors

- `bun run app:ext` - Start browser extension development
  - **Runtime**: 20-40 seconds to start
  - **Common issues**: Manifest v3 validation errors, permission issues
  - **Troubleshooting**: Check extension manifest validity, verify content security policy

- `bun run app:ios` - Start iOS mobile development
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Xcode setup, simulator issues, pod install failures
  - **Prerequisites**: Xcode installed, iOS simulator available

- `bun run app:android` - Start Android mobile development
  - **Runtime**: 1-2 minutes (includes Metro bundler)
  - **Common issues**: Android SDK path, emulator setup, gradle build failures
  - **Prerequisites**: Android Studio, SDK tools, emulator configured

- `bun run app:web-embed` - Start embeddable components development
  - **Runtime**: 15-30 seconds
  - **Usage**: For developing standalone wallet components

## Build Commands

**PRODUCTION BUILDS** (Use for final validation):
- `bun run app:desktop:build` - Build desktop app for all platforms
  - **Runtime**: 5-10 minutes (multi-platform build)
  - **Output**: Platform-specific installers in `apps/desktop/dist/`
  - **Common issues**: Code signing, platform-specific dependencies
  - **Verification**: Test installers on target platforms

- `bun run app:ext:build` - Build browser extension
  - **Runtime**: 2-3 minutes
  - **Output**: Extension packages in `apps/ext/dist/`
  - **Common issues**: Manifest validation, content security policy violations
  - **Verification**: Load extension in browser for testing

- `bun run app:web:build` - Build web application
  - **Runtime**: 3-5 minutes
  - **Output**: Static files in `apps/web/dist/`
  - **Common issues**: Bundle size limits, missing environment variables
  - **Verification**: Serve built files and test functionality

- `bun run app:native-bundle` - Bundle React Native app
  - **Runtime**: 3-5 minutes
  - **Output**: Platform-specific bundles
  - **Common issues**: Native module linking, Metro bundler errors
  - **Prerequisites**: Platform development environment properly configured

## Development Tools & Quality Assurance

**CRITICAL QUALITY COMMANDS** (YOU MUST run these after any code changes):
- `bun run lint` - **MANDATORY** comprehensive linting (TypeScript, ESLint, folder structure, i18n)
  - **Expected runtime**: 5-10 minutes (NEVER skip due to timeout)
  - **Zero tolerance**: ALL warnings and errors MUST be fixed
  - **When it fails**: Check specific error categories and fix systematically
- `bun run test` - **MANDATORY** Jest test execution
  - **Expected runtime**: 2-5 minutes depending on test scope
  - **Failure handling**: Investigate failed tests, do not ignore or skip

**DEVELOPMENT QUALITY WORKFLOW**:
1. Make code changes
2. Run `bun run tsc:only` immediately to catch type errors
3. Run `bun run lint` to ensure code quality (accept full timeout)
4. Run `bun run test` to verify functionality
5. Only proceed if ALL commands pass without errors or warnings

**OTHER TOOLS**:
- `bun run lint:only` - ESLint only (use for quick syntax checks)
- `bun run clean` - Clean all build artifacts and node_modules
- `bun run reinstall` - Full clean install (use when dependency issues occur)

## Testing

- Jest configuration in `jest.config.js`
- Test setup in `jest-setup.js`
- Tests located in `@tests/` directories within packages
- Mobile tests use `jest-expo` preset
