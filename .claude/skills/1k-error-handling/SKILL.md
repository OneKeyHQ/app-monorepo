---
name: 1k-error-handling
description: Error handling patterns and best practices for OneKey. Use when implementing try/catch blocks, handling async errors, showing error messages, or managing error states in UI. Triggers on error, try, catch, exception, throw, fail, failure, error handling, error boundary, useAsyncCall, toast, fallback, error state.
allowed-tools: Read, Grep, Glob
---

# Error Handling

Best practices for error handling in OneKey codebase.

## Core Principles

- Use try/catch blocks for async operations that might fail
- Provide appropriate error messages and fallbacks
- Use `useAsyncCall` hook for operations needing loading/error states
- **Never swallow errors silently**

## Quick Reference

### Basic Try/Catch
```typescript
async function fetchData() {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error; // Re-throw if caller needs to handle
  }
}
```

### With Fallback Value
```typescript
async function fetchDataWithFallback() {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    console.error('Failed to fetch, using fallback:', error);
    return defaultValue; // Return fallback instead of throwing
  }
}
```

### Using useAsyncCall Hook
```typescript
import { useAsyncCall } from '@onekeyhq/kit/src/hooks/useAsyncCall';

function MyComponent() {
  const { run, isLoading, error, result } = useAsyncCall(
    async () => {
      return await fetchData();
    },
    {
      onError: (e) => {
        Toast.error({ title: 'Failed to load data' });
      },
    }
  );

  if (error) {
    return <ErrorView error={error} onRetry={run} />;
  }

  return <DataView data={result} loading={isLoading} />;
}
```

### User-Facing Errors
```typescript
async function submitForm(data: FormData) {
  try {
    await api.submit(data);
    Toast.success({ title: 'Submitted successfully' });
  } catch (error) {
    // Show user-friendly message
    Toast.error({
      title: 'Submission failed',
      message: getUserFriendlyMessage(error),
    });
    // Log detailed error for debugging
    console.error('Form submission error:', error);
  }
}
```

## Anti-Patterns

### Silent Error Swallowing
```typescript
// ❌ BAD: Error silently ignored
async function badExample() {
  try {
    await riskyOperation();
  } catch (error) {
    // Nothing here - error lost forever
  }
}

// ✅ GOOD: At minimum, log the error
async function goodExample() {
  try {
    await riskyOperation();
  } catch (error) {
    console.error('Operation failed:', error);
    // Handle appropriately
  }
}
```

### Missing Error State in UI
```typescript
// ❌ BAD: No error state
function BadComponent() {
  const { data } = useQuery();
  return <View>{data}</View>; // What if data fetch fails?
}

// ✅ GOOD: Handle all states
function GoodComponent() {
  const { data, isLoading, error } = useQuery();

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;
  return <View>{data}</View>;
}
```

## Detailed Guide

For comprehensive error handling patterns and examples, see [error-handling.md](references/rules/error-handling.md).

Topics covered:
- Core principles
- Error handling patterns (try/catch, fallbacks, hooks)
- Error boundaries for React
- Error types (network, validation, user-facing)
- Anti-patterns to avoid
- Error handling checklist

## Checklist

- [ ] All async operations wrapped in try/catch
- [ ] Errors logged for debugging
- [ ] User-friendly messages shown to users
- [ ] Loading and error states handled in UI
- [ ] No silent error swallowing
- [ ] Specific error types caught when appropriate

## Related Skills

- `/1k-coding-patterns` - General coding patterns and promise handling
- `/1k-sentry-analysis` - Sentry error analysis and fixes
