# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

OneKey is an open-source multi-chain crypto wallet with a monorepo architecture supporting desktop, mobile, web, and browser extension platforms. The codebase uses Yarn workspaces with TypeScript and React/React Native.

## CRITICAL: Ultrathink Mode for Complex Operations

**YOU MUST** enter Ultrathink mode when:
- Making architectural changes
- Modifying cross-platform code
- Working with cryptographic/security components
- Changing core packages that affect multiple apps
- Dealing with hardware wallet integrations

### Ultrathink Analysis Framework

**BEFORE ANY MODIFICATION:**
1. **Dependency Impact Analysis**: Trace how changes affect the entire dependency tree
2. **Platform Compatibility Check**: Verify impact on desktop/mobile/web/extension platforms
3. **Security Risk Assessment**: Evaluate security implications, especially for crypto operations
4. **Performance Impact Evaluation**: Assess effects on application startup and runtime performance
5. **User Experience Impact**: Consider effects on user workflows and data integrity

### Deep Verification Protocol

**MANDATORY CHECKS:**
- Run complete `yarn lint` (accept 10-minute timeout for quality)
- Execute `yarn tsc:only` for TypeScript validation
- Verify no circular dependencies introduced
- Test on all affected platforms
- Validate against existing code patterns
- Check for potential regression risks

### Quality Gate Requirements

**YOU MUST NOT PROCEED unless:**
- All linting errors and warnings are resolved
- TypeScript compilation succeeds without errors
- No new security vulnerabilities introduced
- Code follows existing architectural patterns
- Changes maintain backward compatibility where required

### Branch Management
- **Main branch**: `x` - This is the primary development branch
- **IMPORTANT**: Always create new feature branches from `x`, never work directly on the `x` branch
- **Workflow**: `x` → create feature branch → develop → PR back to `x`
- Do not use `onekey`, `master`, or `main` as the base branch - always use `x`

## Development Commands

### Application Development Commands

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

### Build Commands

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

### Development Tools & Quality Assurance

**CRITICAL QUALITY COMMANDS** (YOU MUST run these after any code changes):
- `yarn lint` - **MANDATORY** comprehensive linting (TypeScript, ESLint, folder structure, i18n) 
  - **Expected runtime**: 5-10 minutes (NEVER skip due to timeout)
  - **Zero tolerance**: ALL warnings and errors MUST be fixed
  - **When it fails**: Check specific error categories and fix systematically
- `yarn tsc:only` - **REQUIRED** TypeScript type checking
  - **Expected runtime**: 30-60 seconds
  - **Failure scenarios**: Circular dependencies, type mismatches, missing imports
  - **Action required**: Fix ALL TypeScript errors before proceeding
- `yarn test` - **MANDATORY** Jest test execution
  - **Expected runtime**: 2-5 minutes depending on test scope
  - **Failure handling**: Investigate failed tests, do not ignore or skip

**DEVELOPMENT QUALITY WORKFLOW**:
1. Make code changes
2. Run `yarn tsc:only` immediately to catch type errors
3. Run `yarn lint` to ensure code quality (accept full timeout)
4. Run `yarn test` to verify functionality
5. Only proceed if ALL commands pass without errors or warnings

**OTHER TOOLS**:
- `yarn lint:only` - ESLint only (use for quick syntax checks)
- `yarn clean` - Clean all build artifacts and node_modules
- `yarn reinstall` - Full clean install (use when dependency issues occur)

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

### Import Hierarchy Rules - STRICTLY ENFORCED

**CRITICAL**: Violating these rules WILL break the build and cause circular dependencies.

**HIERARCHY (NEVER violate this order):**
- `@onekeyhq/shared` - **FORBIDDEN** to import from any other OneKey packages
- `@onekeyhq/components` - **ONLY** allowed to import from `shared`
- `@onekeyhq/kit-bg` - **ONLY** allowed to import from `shared` and `core` (NEVER `components` or `kit`)
- `@onekeyhq/kit` - Can import from `shared`, `components`, and `kit-bg`
- Apps (desktop/mobile/ext/web) - Can import from all packages

**BEFORE ADDING ANY IMPORT:**
1. Verify the import respects the hierarchy above
2. Check if the import creates a circular dependency
3. Run `yarn tsc:only` to validate no circular dependency introduced
4. If unsure, find an alternative approach that respects the hierarchy

**COMMON VIOLATIONS TO AVOID:**
- ❌ Importing from `@onekeyhq/kit` in `@onekeyhq/components`
- ❌ Importing from `@onekeyhq/components` in `@onekeyhq/kit-bg`
- ❌ Importing from `@onekeyhq/kit` in `@onekeyhq/core`
- ❌ Any "upward" imports in the hierarchy

### Component Structure
- UI components in `packages/components/src/`
- Business logic in `packages/kit/src/`
- Chain-specific code in `packages/core/src/chains/`

## Testing

- Jest configuration in `jest.config.js`
- Test setup in `jest-setup.js`
- Tests located in `@tests/` directories within packages
- Mobile tests use `jest-expo` preset

## Security Considerations - ABSOLUTE REQUIREMENTS

**FORBIDDEN ACTIONS** (NEVER DO THESE):
- ❌ **NEVER** commit sensitive information (API keys, private keys, secrets, mnemonics)
- ❌ **NEVER** log sensitive data in console or files
- ❌ **NEVER** expose private keys or seeds in any form
- ❌ **NEVER** bypass security validations or authentication
- ❌ **NEVER** modify cryptographic functions without deep security review

**MANDATORY SECURITY PRACTICES**:
- ✅ Hardware wallet communication MUST remain isolated in background processes
- ✅ Encryption using AES-256 for local storage is REQUIRED
- ✅ Transaction verification and risk detection MUST NOT be bypassed
- ✅ Content Security Policy MUST be maintained in extensions
- ✅ ALL user inputs MUST be validated and sanitized
- ✅ Crypto operations MUST follow established patterns

**SECURITY VERIFICATION CHECKLIST**:
1. Does this change handle sensitive data? → Apply extra security measures
2. Does this affect transaction flows? → Verify all security validations remain intact
3. Does this change authentication/authorization? → Requires thorough security review
4. Does this modify cryptographic operations? → Must maintain security standards

## Deep Analysis & Architecture Consistency Framework

### Pre-Modification Analysis Protocol

**MANDATORY ANALYSIS STEPS** (Execute BEFORE any code changes):

1. **Scope Impact Assessment**
   - Identify ALL packages/apps affected by the change
   - Map dependencies that will be impacted (use `yarn why <package>` if needed)
   - Evaluate cross-platform implications (desktop/mobile/web/extension)
   - Assess backward compatibility requirements

2. **Pattern Consistency Verification**
   - Examine existing similar implementations in the codebase
   - Identify established patterns and conventions used
   - Verify new code follows identical patterns
   - Check naming conventions align with existing code

3. **Architecture Integrity Check**
   - Validate against monorepo import hierarchy rules
   - Ensure separation of concerns is maintained
   - Verify platform-specific code uses correct file extensions
   - Check that business logic stays in appropriate packages

4. **Performance Impact Evaluation**
   - Consider bundle size implications (especially for web/extension)
   - Evaluate runtime performance effects
   - Assess memory usage implications
   - Consider impact on application startup time

### Code Pattern Recognition Framework

**WHEN ADDING NEW FUNCTIONALITY:**
1. **Find Similar Examples**: Search codebase for similar implementations
2. **Extract Patterns**: Identify common approaches, naming, structure
3. **Follow Conventions**: Mirror existing patterns exactly
4. **Validate Consistency**: Ensure new code looks like existing code

**WHEN MODIFYING EXISTING CODE:**
1. **Understand Context**: Read surrounding code and imports
2. **Preserve Patterns**: Maintain existing architectural decisions
3. **Consistent Style**: Match existing code style and structure
4. **Validate Integration**: Ensure changes integrate seamlessly

### Architecture Validation Checklist

**BEFORE COMMITTING ANY CHANGES:**
- [ ] Import hierarchy rules respected (no upward imports)
- [ ] Platform-specific files use correct extensions
- [ ] Security patterns maintained (especially for crypto operations)
- [ ] Error handling follows established patterns
- [ ] State management patterns consistently applied
- [ ] UI component patterns followed (Tamagui usage)
- [ ] Translation patterns properly implemented
- [ ] Testing patterns maintained and extended

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

### Promise Handling - MANDATORY COMPLIANCE
- **ALWAYS** await Promises; use `void` prefix ONLY if intentionally not awaiting
- **ZERO TOLERANCE** for floating promises - they cause unhandled rejections
- **FOLLOW** the `@typescript-eslint/no-floating-promises` rule strictly
- **BEFORE ANY ASYNC OPERATION**: Consider error scenarios and add appropriate try/catch blocks
- **VERIFY**: All Promise chains have proper error handling

### React Components
- Avoid default React import; use named imports only
- Prefer functional components over class components
- Use pure functions to create components; avoid importing `import type { FC } from 'react'`
- Follow React hooks rules (dependencies array, call only at top level)
- Use the `usePromiseResult` and `useAsyncCall` hooks with proper dependency arrays

### Restricted Patterns - STRICTLY FORBIDDEN

**ABSOLUTELY FORBIDDEN PATTERNS**:
- ❌ **NEVER** use `toLocaleLowerCase()` or `toLocaleUpperCase()` → Use `toLowerCase()` and `toUpperCase()` instead
- ❌ **NEVER** directly import from `'@onekeyfe/hd-core'` → ALWAYS use `const {} = await CoreSDKLoader()` pattern
- ❌ **NEVER** import `localDbInstance` directly → ALWAYS use `localDb` instead
- ❌ **NEVER** work directly on the `x` branch → ALWAYS create feature branches
- ❌ **NEVER** modify auto-generated files (`translations.ts`, locale JSON files)
- ❌ **NEVER** bypass TypeScript types with `any` or `@ts-ignore` without documented justification
- ❌ **NEVER** commit code that fails linting or TypeScript compilation

**VIOLATION CONSEQUENCES**:
- Build failures and broken development environment
- Security vulnerabilities and data corruption
- Breaking multi-platform compatibility
- Circular dependency hell

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

### Translation Management - CRITICAL RESTRICTIONS

**ABSOLUTELY FORBIDDEN** (These files are AUTO-GENERATED):
- ❌ **NEVER** modify `@onekeyhq/shared/src/locale/enum/translations.ts` - Will be overwritten and break i18n system
- ❌ **NEVER** modify locale JSON files in `@onekeyhq/shared/src/locale/json/*` - Managed by external translation system
- ❌ **NEVER** hardcode text strings in components - ALWAYS use translation keys
- ❌ **NEVER** add translation keys directly to enum files - Use proper workflow

**CONSEQUENCES OF VIOLATION**:
- Translation system corruption
- Loss of translation work
- Build failures in i18n pipeline
- Breaking localization for international users

### Using Translations
- Use `useFormatMessage` or `formatMessage` functions for displaying translated text
- Define new translation keys in the appropriate modules
- Always use translation keys instead of hardcoding text strings
- Follow the established pattern for translation keys: `namespace__action_or_description`

### Updating Translation Keys
1. **Direct translation from design specs**: Update i18n directly based on design spec annotations without searching existing translation keys
2. Run `yarn fetch:locale` to pull the latest translation keys from the remote system
3. This command automatically updates `@onekeyhq/shared/src/locale/enum/translations.ts` with new translation enums
4. For design spec translation keys like `prime::restore_purchases`, convert to code format:
   - Replace `::` with `_` (underscore)
   - Use the enum: `ETranslations.prime_restore_purchases`
   - In component code:
     ```tsx
     {intl.formatMessage({
       id: ETranslations.prime_restore_purchases,
     })}
     ```

### Locale Handling
- The system uses automatic locale detection with fallbacks
- Default locale fallback chain is implemented in `getDefaultLocale.ts`
- Respect platform-specific locale handling (web, native, desktop, extension)
