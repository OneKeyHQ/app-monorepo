# Promise Handling

Mandatory compliance rules for handling Promises in OneKey codebase.

## Core Rules

- **ALWAYS** await Promises; use `void` prefix ONLY if intentionally not awaiting
- **ZERO TOLERANCE** for floating promises - they cause unhandled rejections
- **FOLLOW** the `@typescript-eslint/no-floating-promises` rule strictly
- **BEFORE ANY ASYNC OPERATION**: Consider error scenarios and add appropriate try/catch blocks
- **VERIFY**: All Promise chains have proper error handling

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

### Error Handling Pattern

```typescript
// GOOD: Proper error handling
async function processData() {
  try {
    const data = await fetchData();
    await saveData(data);
    return { success: true };
  } catch (error) {
    // Log error for debugging
    console.error('processData failed:', error);
    // Re-throw or return error state
    return { success: false, error };
  }
}

// GOOD: Using void for fire-and-forget
function handleButtonPress() {
  // Explicitly mark as intentionally not awaited
  void analytics.trackEvent('button_pressed');
}
```

### Promise Chain Pattern

```typescript
// GOOD: Properly chained with error handling
fetchUser()
  .then((user) => fetchUserDetails(user.id))
  .then((details) => updateUI(details))
  .catch((error) => showErrorMessage(error));

// BAD: No error handling
fetchUser()
  .then((user) => fetchUserDetails(user.id))
  .then((details) => updateUI(details)); // ❌ Missing catch
```

## Common Mistakes

### Floating Promise in Event Handler

```typescript
// BAD: Floating promise
const handlePress = () => {
  doAsyncWork(); // ❌ Not awaited, no void
};

// GOOD: Use void for fire-and-forget
const handlePress = () => {
  void doAsyncWork();
};

// GOOD: Use async handler
const handlePress = async () => {
  await doAsyncWork();
};
```

### Missing Try/Catch

```typescript
// BAD: No error handling
async function loadData() {
  const data = await fetchData(); // ❌ Could throw
  setState(data);
}

// GOOD: With error handling
async function loadData() {
  try {
    const data = await fetchData();
    setState(data);
  } catch (error) {
    setError(error);
  }
}
```

## Checklist

- [ ] All async functions have try/catch where errors are possible
- [ ] No floating promises (all awaited or prefixed with `void`)
- [ ] Error states are handled appropriately
- [ ] ESLint `@typescript-eslint/no-floating-promises` passes
