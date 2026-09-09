---
name: 1k-coding-patterns
description: OneKey coding patterns for TypeScript, React, promises, date formatting, and error handling.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# OneKey Coding Patterns and Best Practices

## Quick Reference

| Topic | Guide | Key Points |
|-------|-------|------------|
| Promise handling | [promise-handling.md](references/rules/promise-handling.md) | Always await or use `void`, never floating promises |
| React components | [react-components.md](references/rules/react-components.md) | Named imports, functional components, no FC type |
| Restricted patterns | [restricted-patterns.md](references/rules/restricted-patterns.md) | Forbidden: `toLocaleLowerCase`, direct hd-core import |
| Date formatting | [date-formatting.md](references/date-formatting.md) | Use OneKey `dateUtils`, not native date formatting |
| Error handling | [error-handling.md](references/error-handling.md) | Preserve errors across RPC/runtime boundaries |

## Critical Rules Summary

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

## Related Skills

- `/1k-i18n` - Internationalization and translations
- `/1k-cross-platform` - Platform-specific code
- `/1k-code-quality` - Linting and code quality
- `/1k-performance` - Performance optimization
- `/1k-state-management` - Jotai atom patterns
- `/1k-architecture` - Project structure and import rules
