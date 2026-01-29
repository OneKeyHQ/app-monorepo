---
name: 1k-coding-patterns
description: Coding patterns and best practices for OneKey development. Use when writing React components, handling promises, error handling, or following code conventions. Triggers on react, component, hooks, promise, async, await, error, pattern, convention, typescript.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# OneKey Coding Patterns and Best Practices

## Quick Reference

| Topic | Guide | Key Points |
|-------|-------|------------|
| Date formatting | [date-formatting.md](references/rules/date-formatting.md) | Use `formatDate()` from dateUtils, never native JS |
| Internationalization | [i18n.md](references/rules/i18n.md) | Use `ETranslations` enum, never hardcode strings |
| Promise handling | [promise-handling.md](references/rules/promise-handling.md) | Always await or use `void`, never floating promises |
| React components | [react-components.md](references/rules/react-components.md) | Named imports, functional components, no FC type |
| Restricted patterns | [restricted-patterns.md](references/rules/restricted-patterns.md) | Forbidden: `toLocaleLowerCase`, direct hd-core import |
| Error handling | [error-handling.md](references/rules/error-handling.md) | Try/catch for async, user-friendly messages |
| Code quality | [code-quality.md](references/rules/code-quality.md) | English comments, lint before commit |
| Cross-platform | [cross-platform.md](references/rules/cross-platform.md) | Use `platformEnv`, file extensions for platform code |

## Critical Rules Summary

### Date Formatting

```typescript
// ❌ FORBIDDEN
date.toLocaleDateString()

// ✅ CORRECT
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
formatDate(date, { hideSeconds: true });
```

### Internationalization

```typescript
// ❌ FORBIDDEN
<Text>Confirm</Text>

// ✅ CORRECT
import { ETranslations } from '@onekeyhq/shared/src/locale';
intl.formatMessage({ id: ETranslations.global__confirm });
```

### Promise Handling

```typescript
// ❌ FORBIDDEN - floating promise
apiCall();

// ✅ CORRECT
await apiCall();
// or
void apiCall(); // intentionally not awaited
```

### React Components

```typescript
// ❌ FORBIDDEN
import React, { FC } from 'react';
const MyComponent: FC<Props> = () => {};

// ✅ CORRECT
import { useState, useCallback } from 'react';
function MyComponent({ prop }: { prop: string }) {}
```

### Restricted Patterns

```typescript
// ❌ FORBIDDEN
string.toLocaleLowerCase()
import { x } from '@onekeyfe/hd-core';
import { localDbInstance } from '...';

// ✅ CORRECT
string.toLowerCase()
const { x } = await CoreSDKLoader();
import { localDb } from '...';
```

### Error Handling

```typescript
// ❌ BAD - silent failure
try { await risky(); } catch (e) {}

// ✅ CORRECT
try {
  await risky();
} catch (error) {
  console.error('Failed:', error);
  Toast.error({ title: 'Operation failed' });
}
```

### Code Quality

```bash
# Pre-commit (fast, recommended)
yarn lint:staged
yarn tsc:staged

# CI only (full project check)
yarn lint
```

### Cross-Platform

```typescript
// ✅ CORRECT - Use platformEnv
import platformEnv from '@onekeyhq/shared/src/platformEnv';
if (platformEnv.isNative) { /* mobile */ }

// ✅ CORRECT - Use file extensions
// MyComponent.native.tsx, MyComponent.web.tsx

// ❌ FORBIDDEN
if (typeof window !== 'undefined') { }
```

## Related Skills

- `/1k-state-management` - Jotai atom patterns
- `/1k-architecture` - Project structure and import rules
- `/1k-dev-workflows` - Lint fixes, pre-commit tasks
