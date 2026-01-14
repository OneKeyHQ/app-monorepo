---
name: 1k-coding-patterns
description: Coding patterns and best practices for OneKey development. Use when writing React components, handling promises, error handling, or following code conventions. Triggers on react, component, hooks, promise, async, await, error, pattern, convention, typescript.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# OneKey Coding Patterns and Best Practices

## General Development
- Develop functions with a test-driven development mindset, ensuring each low-level function or method intended for reuse performs a single, atomic task, but avoid adding unnecessary abstraction layers

## Promise Handling - MANDATORY COMPLIANCE
- **ALWAYS** await Promises; use `void` prefix ONLY if intentionally not awaiting
- **ZERO TOLERANCE** for floating promises - they cause unhandled rejections
- **FOLLOW** the `@typescript-eslint/no-floating-promises` rule strictly
- **BEFORE ANY ASYNC OPERATION**: Consider error scenarios and add appropriate try/catch blocks
- **VERIFY**: All Promise chains have proper error handling

## React Components
- Avoid default React import; use named imports only
- Prefer functional components over class components
- Use pure functions to create components; avoid importing `import type { FC } from 'react'`
- Follow React hooks rules (dependencies array, call only at top level)
- Use the `usePromiseResult` and `useAsyncCall` hooks with proper dependency arrays

## Restricted Patterns - STRICTLY FORBIDDEN

**ABSOLUTELY FORBIDDEN PATTERNS**:
- ❌ **NEVER** use `toLocaleLowerCase()` or `toLocaleUpperCase()` → Use `toLowerCase()` and `toUpperCase()` instead
- ❌ **NEVER** directly import from `'@onekeyfe/hd-core'` → ALWAYS use `const {} = await CoreSDKLoader()` pattern
- ❌ **NEVER** import `localDbInstance` directly → ALWAYS use `localDb` instead
- ❌ **NEVER** modify auto-generated files (`translations.ts`, locale JSON files)
- ❌ **NEVER** bypass TypeScript types with `any` or `@ts-ignore` without documented justification
- ❌ **NEVER** commit code that fails linting or TypeScript compilation

**VIOLATION CONSEQUENCES**:
- Build failures and broken development environment
- Security vulnerabilities and data corruption
- Breaking multi-platform compatibility
- Circular dependency hell

## Error Handling
- Use try/catch blocks for async operations that might fail
- Provide appropriate error messages and fallbacks
- Consider using the `useAsyncCall` hook for operations that need loading/error states

## Linting and Code Quality
- ESLint warnings should be fixed before PRs
- Run `yarn run lint` to check for and fix ESLint issues

## Comments and Documentation
- All comments must be written in English
- Use clear and concise English for inline comments, function documentation, and code explanations
- Avoid using non-English languages in comments to maintain consistency and accessibility for all developers
- Do not use Chinese comments; always use English comments only

## Code Examples

### Correct Promise Handling
```typescript
// GOOD: Properly awaited
async function fetchData() {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}

// GOOD: Intentionally not awaited (with void)
void backgroundTask();

// BAD: Floating promise
function badExample() {
  apiCall(); // ❌ Will trigger lint error
}
```

### Correct React Component Pattern
```typescript
// GOOD: Named imports, functional component
import { useState, useEffect, useCallback } from 'react';
import { Stack, Button } from '@onekeyhq/components';

function MyComponent({ data }: { data: MyData }) {
  const [state, setState] = useState(null);

  const handlePress = useCallback(() => {
    // handler logic
  }, []);

  return (
    <Stack>
      <Button onPress={handlePress}>Action</Button>
    </Stack>
  );
}

// BAD: Default import, FC type
import React, { FC } from 'react'; // ❌
const MyComponent: FC<Props> = () => {}; // ❌
```

### Correct HD Core Usage
```typescript
// GOOD: Use CoreSDKLoader
async function useHardware() {
  const { HardwareSDK } = await CoreSDKLoader();
  // use HardwareSDK
}

// BAD: Direct import
import { HardwareSDK } from '@onekeyfe/hd-core'; // ❌
```
