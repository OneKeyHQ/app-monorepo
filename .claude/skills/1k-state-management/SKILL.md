---
name: 1k-state-management
description: Jotai state management patterns for OneKey. Use when working with atoms, global state, feature state, or context atoms. Triggers on jotai, atom, state, globalAtom, contextAtom, store, persistence, settings.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# OneKey State Management

## Jotai Atom Organization - MANDATORY STRUCTURE

### Global State Atoms (for app-wide, persistent state)
- **Location**: `packages/kit-bg/src/states/jotai/atoms/`
- **Usage**: Global settings, account state, hardware state, currency, etc.
- **Pattern**: Use `globalAtom` and `EAtomNames` for standardization
- **Examples**: `settings.ts`, `account.ts`, `hardware.ts`, `currency.ts`

### Feature-Specific State Atoms (for localized functionality)
- **Location**: `packages/kit/src/states/jotai/contexts/[feature_name]/atoms.ts`
- **Usage**: Feature-specific state that may be shared across components within that feature
- **Pattern**: Use `contextAtom` from `createJotaiContext` for consistency
- **Structure**:
  ```
  contexts/
  ├── marketV2/
  │   ├── atoms.ts     - State definitions
  │   ├── actions.ts   - State operations
  │   └── index.ts     - Exports
  ├── swap/
  │   ├── atoms.ts
  │   ├── actions.ts
  │   └── index.ts
  ```

## FORBIDDEN Atom Patterns
- ❌ **NEVER** create atom directories under `packages/kit/src/views/`
- ❌ **NEVER** create standalone atom files in component directories
- ❌ **NEVER** mix `globalAtom` and `contextAtom` patterns without architectural justification

## Atom Selection Guidelines

### Use globalAtom when:
- State needs persistence across app restarts
- State is used across multiple major features
- State affects the entire application (settings, authentication, etc.)
- Located in `packages/kit-bg/src/states/jotai/atoms/`

### Use contextAtom when:
- State is specific to a feature or module
- State is temporary/session-based
- State is shared within related components of a feature
- Located in `packages/kit/src/states/jotai/contexts/[name]/atoms.ts`

**IMPORTANT**: These are the ONLY two atom patterns used in the project. Do not create custom atom patterns or use plain Jotai atoms outside of these established structures.

## Common Patterns

### Creating a Global Atom
```typescript
// packages/kit-bg/src/states/jotai/atoms/myFeature.ts
import { globalAtom } from '../utils';
import { EAtomNames } from '../atomNames';

export const myFeatureAtom = globalAtom<MyFeatureState>({
  name: EAtomNames.myFeature,
  initialValue: { /* initial state */ },
  persist: true, // if persistence needed
});
```

### Creating a Context Atom
```typescript
// packages/kit/src/states/jotai/contexts/myFeature/atoms.ts
import { createJotaiContext } from '../../utils';

const { contextAtom, useContextAtom } = createJotaiContext();

export const myFeatureDataAtom = contextAtom<MyData | null>(null);

// Export hook for components
export { useContextAtom };
```

### Using Atoms in Components
```typescript
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { myFeatureAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function MyComponent() {
  // Read and write
  const [value, setValue] = useAtom(myFeatureAtom);

  // Read only
  const value = useAtomValue(myFeatureAtom);

  // Write only
  const setValue = useSetAtom(myFeatureAtom);
}
```
