---
name: ignoring-sentry-errors
description: Filters specific errors from Sentry reporting in this OneKey monorepo. Use when needing to ignore/suppress/filter Sentry errors, add error exclusions, or stop certain errors from being reported. Handles platform-specific filtering (desktop/mobile/web/extension).
---

# Ignoring Sentry Errors

Follow this workflow to add new error filters to Sentry configuration.

## Key File

All error filtering logic is centralized in:
```
packages/shared/src/modules3rdParty/sentry/basicOptions.ts
```

## Workflow

### 1) Analyze the error

Identify the error pattern:
- **Error type** (e.g., `Error`, `TypeError`, `AxiosError`)
- **Error message/value** (the text content)
- **Platform** (desktop/mobile/web/extension or all)
- **Frequency** (sporadic vs constant)
- **Impact** (blocks users or just noise)

### 2) Choose filtering strategy

**Option A: Filter by error type** (recommended for known error classes)

Add to `FILTERED_ERROR_TYPES` Set:
```typescript
const FILTERED_ERROR_TYPES = new Set([
  'AxiosError',
  'HTTPClientError',
  // Add your error type here
  'YourErrorType',
]);
```

**Option B: Filter by exact message match**

Add to `FILTER_ERROR_VALUES` array:
```typescript
const FILTER_ERROR_VALUES = ['AbortError: AbortError', 'cancel timeout'];
```

**Option C: Filter by partial message match** (for dynamic messages)

Add to `isFilterErrorAndSkipSentry` function:
```typescript
// Platform-specific filter (group with existing platform checks)
if (platformEnv.isDesktop && error.value) {
  if (error.value.includes('YOUR_ERROR_PATTERN')) {
    return true;
  }
}

// Cross-platform filter
if (error.value && error.value.includes('YOUR_ERROR_PATTERN')) {
  return true;
}
```

### 3) Implementation pattern

For platform-specific errors, group checks to minimize redundant conditions:

```typescript
// Desktop-specific error filters (grouped)
if (platformEnv.isDesktop && error.value) {
  // Filter 1
  if (error.value.includes('Pattern1')) {
    return true;
  }
  // Filter 2 (check shorter string first for performance)
  if (
    error.value.includes('ShortPattern') &&
    error.value.includes('LongerPatternForSpecificity')
  ) {
    return true;
  }
}
```

### 4) Verify changes

```bash
yarn eslint packages/shared/src/modules3rdParty/sentry/basicOptions.ts --quiet
```

## Platform Detection

Use `platformEnv` for platform-specific filtering:
```typescript
import platformEnv from '@onekeyhq/shared/src/platformEnv';

platformEnv.isDesktop    // Electron desktop app
platformEnv.isNative     // React Native (iOS/Android)
platformEnv.isWeb        // Web browser
platformEnv.isExtension  // Browser extension
platformEnv.isWebEmbed   // Embedded web components
```

## Best Practices

1. **Check shorter strings first** - Better performance for `includes()` chains
2. **Group platform checks** - Avoid redundant `platformEnv` evaluations
3. **Add comments** - Explain why the error is being filtered
4. **Preserve local logging** - Filtered errors still get logged via `onError` callback
5. **Be specific** - Use multiple `includes()` for dynamic messages to avoid false positives

## Example: Filtering Electron webview errors

```typescript
// Filter Electron webview connection closed error (network interruption during webview loading)
// Check shorter string first for better performance
if (
  error.value.includes('ERR_CONNECTION_CLOSED') &&
  error.value.includes('GUEST_VIEW_MANAGER_CALL')
) {
  return true;
}
```

## Related Files

- Main Sentry config: `apps/desktop/app/sentry.ts`
- Desktop renderer: `packages/shared/src/modules3rdParty/sentry/index.desktop.ts`
- Web/Extension: `packages/shared/src/modules3rdParty/sentry/index.ts`
- Native: `packages/shared/src/modules3rdParty/sentry/index.native.ts`
