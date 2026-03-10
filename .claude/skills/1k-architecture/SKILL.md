---
name: 1k-architecture
description: OneKey monorepo architecture, project structure, package relationships, and import hierarchy rules.
allowed-tools: Read, Grep, Glob
---

# OneKey Architecture Overview

## Platform Structure
- **`apps/desktop/`** - Electron desktop app (Windows, macOS, Linux)
- **`apps/mobile/`** - React Native mobile app (iOS, Android)
- **`apps/ext/`** - Browser extension (Chrome, Firefox, Edge, Brave)
- **`apps/web/`** - Progressive web application
- **`apps/web-embed/`** - Embeddable wallet components

## Core Packages
- **`packages/core/`** - Blockchain protocol implementations, cryptography, hardware wallet communication
- **`packages/kit/`** - Application logic, state management, API integrations
- **`packages/kit-bg/`** - Background services and workers
- **`packages/components/`** - Tamagui-based cross-platform UI components
- **`packages/shared/`** - Platform abstractions, utilities, build configurations
- **`packages/qr-wallet-sdk/`** - Air-gapped wallet QR communication

## Key Architectural Patterns
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
3. If unsure, find an alternative approach that respects the hierarchy

**COMMON VIOLATIONS TO AVOID:**
- ❌ Importing from `@onekeyhq/kit` in `@onekeyhq/components`
- ❌ Importing from `@onekeyhq/components` in `@onekeyhq/kit-bg`
- ❌ Importing from `@onekeyhq/kit` in `@onekeyhq/core`
- ❌ Any "upward" imports in the hierarchy

### Component Structure
- UI components in `packages/components/src/`
- Business logic in `packages/kit/src/`
- Chain-specific code in `packages/core/src/chains/`

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
