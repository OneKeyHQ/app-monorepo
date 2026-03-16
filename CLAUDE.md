# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

OneKey is an open-source multi-chain crypto wallet with a monorepo architecture supporting desktop, mobile, web, and browser extension platforms. The codebase uses Yarn workspaces with TypeScript and React/React Native.

## Language & Types

Primary language: TypeScript. When making code changes, always ensure TypeScript types are correct — never use fallback types like `never[]` when a specific type is expected. Run `tsc --noEmit` on affected files after edits.

## Platform Considerations

This is a React Native project targeting iOS, Android, and Web. Always consider platform-specific behavior when making changes. Use Platform.select or platform-specific file extensions (.ios.ts, .android.ts, .web.ts) where appropriate. Never apply global CSS/style changes when platform-specific fixes are needed.

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
- ❌ **NEVER** use `JSON.stringify()` for cryptographic operations → ALWAYS use `stringUtils.stableStringify()` for deterministic serialization when computing hashes or signatures

## Code Changes

When fixing bugs, do NOT remove existing code/components that weren't part of the request. Only modify what is explicitly asked for. If you believe something should be removed, ask first.

## Dependencies & Patching

When working with patch-package, never edit .patch files directly. Instead, modify the source files in node_modules/ and run `npx patch-package <package-name>` to regenerate the patch. Always verify the generated patch excludes build artifacts (e.g., android/build/).

## Git Basics

- **Main branch**: `x` - Always use `x` as the base branch (not `master` or `main`)
- **NEVER** work directly on the `x` branch → ALWAYS create feature branches
- **Commit format**: `type: short description` (feat, fix, refactor, chore, docs)
- Do NOT include "Co-Authored-By" signatures in commits (no Claude, no Happy, no AI tool attribution)
- Do NOT include "Generated with" or "via" tool attribution lines in commit messages
- When creating PRs or commits, ensure the git history is clean. Never amend into merge commits. If multiple fixes are needed, squash them into logical commits before pushing.

## Debugging

- After making a fix attempt that the user reports as not working, do NOT retry the same approach with minor tweaks. Instead, re-analyze the root cause from scratch, explain your new hypothesis, and propose a fundamentally different approach before implementing.
- When the user reports a visual bug, ask for the specific platform and confirm the expected vs actual behavior before attempting a fix. Do not assume the root cause — misdiagnosis wastes rounds.

## Essential Commands

```bash
yarn app:desktop    # Start desktop dev
yarn app:web        # Start web dev
yarn app:ext        # Start extension dev
yarn app:ios        # Start iOS dev
yarn app:android    # Start Android dev
yarn lint:staged    # MANDATORY: Lint staged files before commit
yarn tsc:staged     # MANDATORY: Type check staged files before commit
yarn test           # MANDATORY: Run tests
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
- **1k-bundle-release** - Bundle hot update release management (cherry-pick, diff-check, publish)
