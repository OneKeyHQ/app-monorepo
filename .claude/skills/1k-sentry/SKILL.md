---
name: 1k-sentry
description: Sentry error tracking and monitoring for OneKey. Use when configuring Sentry, filtering errors, analyzing crash reports, or debugging production issues. Covers platform-specific setup (desktop/mobile/web/extension) and error filtering strategies.
---

# Sentry Integration

OneKey uses Sentry for error tracking across all platforms.

## Architecture Overview

```
apps/
├── desktop/app/sentry.ts          # Desktop main process
├── ext/                           # Extension (uses shared)
├── mobile/                        # Mobile (uses shared)
└── web/                           # Web (uses shared)

packages/shared/src/modules3rdParty/sentry/
├── index.ts                       # Web/Extension entry
├── index.native.ts                # React Native entry
├── index.desktop.ts               # Desktop renderer entry
├── basicOptions.ts                # Shared config & error filtering
└── instance.ts                    # Sentry client instance
```

## Platform Detection

```typescript
import platformEnv from '@onekeyhq/shared/src/platformEnv';

platformEnv.isDesktop    // Electron desktop app
platformEnv.isNative     // React Native (iOS/Android)
platformEnv.isWeb        // Web browser
platformEnv.isExtension  // Browser extension
platformEnv.isWebEmbed   // Embedded web components
```

## Common Tasks

### Filter/Ignore Errors

See: [references/rules/ignoring-errors.md](references/rules/ignoring-errors.md)

Key file: `packages/shared/src/modules3rdParty/sentry/basicOptions.ts`

### Analyze Crash Reports

1. Get crash details from Sentry dashboard
2. Identify error type, message, and stack trace
3. Check platform-specific context
4. Use related skills for fixes:
   - Native crashes → `/1k-patching-native-modules`
   - JS errors → Fix in codebase

### Add Custom Context

```typescript
import * as Sentry from '@sentry/react-native'; // or @sentry/browser

// Add breadcrumb
Sentry.addBreadcrumb({
  category: 'action',
  message: 'User clicked button',
  level: 'info',
});

// Set user context
Sentry.setUser({ id: 'user-id' });

// Set tags
Sentry.setTag('feature', 'swap');

// Capture exception with context
Sentry.captureException(error, {
  extra: { additionalData: 'value' },
});
```

## Key Files

| Purpose | File |
|---------|------|
| Error filtering | `packages/shared/src/modules3rdParty/sentry/basicOptions.ts` |
| Desktop main | `apps/desktop/app/sentry.ts` |
| Desktop renderer | `packages/shared/src/modules3rdParty/sentry/index.desktop.ts` |
| Web/Extension | `packages/shared/src/modules3rdParty/sentry/index.ts` |
| Native | `packages/shared/src/modules3rdParty/sentry/index.native.ts` |

## Error Filtering Quick Reference

```typescript
// Filter by error type
const FILTERED_ERROR_TYPES = new Set(['AxiosError', 'HTTPClientError']);

// Filter by exact message
const FILTER_ERROR_VALUES = ['AbortError: AbortError'];

// Filter by pattern (in isFilterErrorAndSkipSentry function)
if (error.value?.includes('PATTERN')) return true;
```

## Related Skills

- `/1k-patching-native-modules` - Fix native crashes found in Sentry
- `/1k-coding-patterns` - Error handling best practices
