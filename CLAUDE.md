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

### Quality Gate Requirements

**YOU MUST NOT PROCEED unless:**
- All linting errors and warnings are resolved
- TypeScript compilation succeeds without errors
- No new security vulnerabilities introduced
- Code follows existing architectural patterns
- Changes maintain backward compatibility where required

## Import Hierarchy Rules - STRICTLY ENFORCED

**CRITICAL**: Violating these rules WILL break the build and cause circular dependencies.

**HIERARCHY (NEVER violate this order):**
- `@onekeyhq/shared` - **FORBIDDEN** to import from any other OneKey packages
- `@onekeyhq/components` - **ONLY** allowed to import from `shared`
- `@onekeyhq/kit-bg` - **ONLY** allowed to import from `shared` and `core` (NEVER `components` or `kit`)
- `@onekeyhq/kit` - Can import from `shared`, `components`, and `kit-bg`
- Apps (desktop/mobile/ext/web) - Can import from all packages

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

## Restricted Patterns - STRICTLY FORBIDDEN

- ❌ **NEVER** use `toLocaleLowerCase()` or `toLocaleUpperCase()` → Use `toLowerCase()` and `toUpperCase()` instead
- ❌ **NEVER** directly import from `'@onekeyfe/hd-core'` → ALWAYS use `const {} = await CoreSDKLoader()` pattern
- ❌ **NEVER** import `localDbInstance` directly → ALWAYS use `localDb` instead
- ❌ **NEVER** modify auto-generated files (`translations.ts`, locale JSON files)
- ❌ **NEVER** bypass TypeScript types with `any` or `@ts-ignore` without documented justification
- ❌ **NEVER** commit code that fails linting or TypeScript compilation

## Git Basics

- **Main branch**: `x` - Always use `x` as the base branch (not `master` or `main`)
- **NEVER** work directly on the `x` branch → ALWAYS create feature branches
- **Commit format**: `type: short description` (feat, fix, refactor, chore, docs)
- Do NOT include "Co-Authored-By: Claude" signature in commits

## Essential Commands

```bash
yarn app:desktop    # Start desktop dev
yarn app:web        # Start web dev
yarn app:ext        # Start extension dev
yarn app:ios        # Start iOS dev
yarn app:android    # Start Android dev
yarn lint           # MANDATORY: Run after code changes
yarn test           # MANDATORY: Run tests
yarn tsc:only       # Quick type check
```

## Skills Reference

For detailed guidance, use these skills (invoke with `/skill-name`):

- **1k-dev-commands** - Development and build commands
- **1k-architecture** - Project structure and import rules
- **1k-state-management** - Jotai atom patterns
- **1k-coding-patterns** - React and TypeScript best practices
- **1k-git-workflow** - Git branching and commit conventions
- **1k-i18n** - Internationalization guidelines
- **1k-cross-platform** - Platform-specific development
- **1k-adding-chains** - Adding new blockchain support
