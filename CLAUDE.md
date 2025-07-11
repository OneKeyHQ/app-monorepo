# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

OneKey is an open-source multi-chain crypto wallet with a monorepo architecture supporting desktop, mobile, web, and browser extension platforms. The codebase uses Yarn workspaces with TypeScript and React/React Native.

### Branch Management
- **Main branch**: `x` - This is the primary development branch
- **IMPORTANT**: Always create new feature branches from `x`, never work directly on the `x` branch
- **Workflow**: `x` → create feature branch → develop → PR back to `x`
- Do not use `onekey`, `master`, or `main` as the base branch - always use `x`

## Development Commands

### Application Development
- `yarn app:desktop` - Start desktop Electron app development
- `yarn app:web` - Start web development server (port 3000)
- `yarn app:ext` - Start browser extension development
- `yarn app:ios` - Start iOS mobile development
- `yarn app:android` - Start Android mobile development
- `yarn app:web-embed` - Start embeddable components development

### Build Commands
- `yarn app:desktop:build` - Build desktop app for all platforms
- `yarn app:ext:build` - Build browser extension
- `yarn app:web:build` - Build web application
- `yarn app:native-bundle` - Bundle React Native app

### Development Tools
- `yarn lint` - Run comprehensive linting (TypeScript, ESLint, folder structure, i18n)
- `yarn tsc:only` - TypeScript type checking only
- `yarn lint:only` - ESLint only
- `yarn test` - Run Jest tests
- `yarn clean` - Clean all build artifacts and node_modules
- `yarn reinstall` - Full clean install

## Architecture Overview

### Platform Structure
- **`apps/desktop/`** - Electron desktop app (Windows, macOS, Linux)
- **`apps/mobile/`** - React Native mobile app (iOS, Android)
- **`apps/ext/`** - Browser extension (Chrome, Firefox, Edge, Brave)
- **`apps/web/`** - Progressive web application
- **`apps/web-embed/`** - Embeddable wallet components

### Core Packages
- **`packages/core/`** - Blockchain protocol implementations, cryptography, hardware wallet communication
- **`packages/kit/`** - Application logic, state management, API integrations
- **`packages/kit-bg/`** - Background services and workers
- **`packages/components/`** - Tamagui-based cross-platform UI components
- **`packages/shared/`** - Platform abstractions, utilities, build configurations
- **`packages/qr-wallet-sdk/`** - Air-gapped wallet QR communication

### Key Architectural Patterns
- **Multi-chain support**: 40+ blockchains with pluggable chain implementations
- **Cross-platform UI**: Tamagui for universal components with platform-specific adaptations
- **Platform-specific files**: Use `.native.ts`, `.desktop.ts`, `.web.ts`, `.ext.ts` suffixes
- **Hardware wallet integration**: Custom `@onekeyfe/hd-*` SDK packages
- **State management**: Jotai for atomic state management

## Code Organization

### File Naming Conventions
- Platform-specific implementations use suffixes: `.native.ts`, `.web.ts`, `.desktop.ts`, `.ext.ts`
- Component files use PascalCase: `ComponentName.tsx`
- Hook files use camelCase with `use` prefix: `useHookName.ts`
- Utility files use camelCase: `utilityName.ts`

### Import Patterns
- Use workspace references: `@onekeyhq/components`, `@onekeyhq/core`, `@onekeyhq/kit`
- Platform detection via `@onekeyhq/shared/src/platformEnv`
- Conditional imports based on platform capabilities

### Import Hierarchy Rules
The import hierarchy must be respected to prevent circular dependencies:
- `@onekeyhq/shared` - Should not import from other packages
- `@onekeyhq/components` - Can import from `shared` only
- `@onekeyhq/kit-bg` - Can import from `shared` and `core` but not `components` or `kit`
- `@onekeyhq/kit` - Can import from `shared`, `components`, and `kit-bg`
- Apps - Can import from all packages

### Component Structure
- UI components in `packages/components/src/`
- Business logic in `packages/kit/src/`
- Chain-specific code in `packages/core/src/chains/`

## Testing

- Jest configuration in `jest.config.js`
- Test setup in `jest-setup.js`
- Tests located in `@tests/` directories within packages
- Mobile tests use `jest-expo` preset

## Security Considerations

- Never commit sensitive information (API keys, private keys, secrets)
- Hardware wallet communication isolated in background processes
- Encryption using AES-256 for local storage
- Transaction verification and risk detection built-in
- Content Security Policy enforced in extensions

## Common Patterns

### Adding New Chains
1. Implement in `packages/core/src/chains/`
2. Add chain configuration to shared constants
3. Update UI components for chain-specific features
4. Add tests for chain functionality

### Cross-Platform Development
1. Start with shared logic in `packages/kit/`
2. Create platform-specific implementations when needed
3. Use Tamagui components for consistent UI
4. Test across all target platforms

#### Platform-Specific Code
- Use platform extensions for platform-specific implementations:
  - `.native.ts` for React Native (iOS/Android)
  - `.web.ts` for web platform
  - `.desktop.ts` for desktop platform
  - `.ext.ts` for browser extension
- Use `import platformEnv from '@onekeyhq/shared/src/platformEnv'` for platform detection
- UI components should work consistently across all platforms
- Keep platform-specific code in separate files with appropriate extensions
- Minimize platform-specific code by keeping common logic separate

### State Management
- Use Jotai atoms for state
- Create context providers for complex state
- Implement selectors for derived state
- Keep platform-specific state isolated

## Coding Patterns and Best Practices

### General Development
- Develop functions with a test-driven development mindset, ensuring each low-level function or method intended for reuse performs a single, atomic task, but avoid adding unnecessary abstraction layers

### Promise Handling
- Always await Promises; use `void` prefix if intentionally not awaiting
- Avoid floating promises to prevent unhandled rejections
- Follow the `@typescript-eslint/no-floating-promises` rule

### React Components
- Avoid default React import; use named imports only
- Prefer functional components over class components
- Use pure functions to create components; avoid importing `import type { FC } from 'react'`
- Follow React hooks rules (dependencies array, call only at top level)
- Use the `usePromiseResult` and `useAsyncCall` hooks with proper dependency arrays

### Restricted Patterns
- Don't use `toLocaleLowerCase()` or `toLocaleUpperCase()`; use `toLowerCase()` and `toUpperCase()` instead
- Don't directly import from '@onekeyfe/hd-core'; use `const {} = await CoreSDKLoader()` instead
- Don't import `localDbInstance` directly; use `localDb` instead

### Error Handling
- Use try/catch blocks for async operations that might fail
- Provide appropriate error messages and fallbacks
- Consider using the `useAsyncCall` hook for operations that need loading/error states

### Linting and Code Quality
- ESLint warnings should be fixed before PRs
- Run `yarn run lint` to check for and fix ESLint issues

### Comments and Documentation
- All comments must be written in English
- Use clear and concise English for inline comments, function documentation, and code explanations
- Avoid using non-English languages in comments to maintain consistency and accessibility for all developers
- Do not use Chinese comments; always use English comments only

## Internationalization (i18n) Guidelines

### Translation Management
- **DO NOT** modify `@onekeyhq/shared/src/locale/enum/translations.ts` - these are automatically generated
- **DO NOT** modify locale JSON files in `@onekeyhq/shared/src/locale/json/*`

### Using Translations
- Use `useFormatMessage` or `formatMessage` functions for displaying translated text
- Define new translation keys in the appropriate modules
- Always use translation keys instead of hardcoding text strings
- Follow the established pattern for translation keys: `namespace__action_or_description`

### Locale Handling
- The system uses automatic locale detection with fallbacks
- Default locale fallback chain is implemented in `getDefaultLocale.ts`
- Respect platform-specific locale handling (web, native, desktop, extension)