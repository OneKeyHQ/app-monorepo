# Error Handling

Best practices for error handling in OneKey codebase.

## Core Principles

- Use try/catch blocks for async operations that might fail
- Provide appropriate error messages and fallbacks
- Consider using the `useAsyncCall` hook for operations that need loading/error states
- Never swallow errors silently

## Patterns

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

### Error Boundaries (React)

```typescript
// For component-level error catching
import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';

function ParentComponent() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ChildComponent />
    </ErrorBoundary>
  );
}
```

## Error Types

### Network Errors

```typescript
async function fetchWithNetworkHandling() {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    if (error instanceof NetworkError) {
      // Handle network-specific error
      Toast.error({ title: 'Network error. Please check your connection.' });
      return null;
    }
    throw error; // Re-throw unknown errors
  }
}
```

### Validation Errors

```typescript
function validateInput(input: string): Result<ValidData, ValidationError> {
  if (!input) {
    return { success: false, error: new ValidationError('Input required') };
  }
  if (input.length < 3) {
    return { success: false, error: new ValidationError('Input too short') };
  }
  return { success: true, data: input };
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

function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message;
  }
  if (error instanceof NetworkError) {
    return 'Please check your internet connection';
  }
  return 'Something went wrong. Please try again.';
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

### Catching Too Broadly

```typescript
// ❌ BAD: Catches everything, including programmer errors
try {
  const result = processData(data);
  undefinedFunction(); // Bug - should not be caught
} catch (error) {
  return fallback;
}

// ✅ GOOD: Catch specific errors
try {
  const result = await fetchData();
} catch (error) {
  if (error instanceof NetworkError) {
    return fallback;
  }
  throw error; // Re-throw unexpected errors
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

## Checklist

- [ ] All async operations wrapped in try/catch
- [ ] Errors logged for debugging
- [ ] User-friendly messages shown to users
- [ ] Loading and error states handled in UI
- [ ] No silent error swallowing
- [ ] Specific error types caught when appropriate
