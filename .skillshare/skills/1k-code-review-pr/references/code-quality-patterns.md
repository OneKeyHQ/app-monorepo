# Code Quality Patterns

Focus on patterns that cause real bugs in this codebase. Claude already knows basic React — these are the non-obvious gotchas.

## 1. React Hooks Safety

### eslint-disable hiding dependency bugs
```typescript
// Red flag: WHY is this disabled? Read the suppressed deps.
useEffect(() => {
  doSomething(someValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
If `someValue` changes, this effect won't re-run. Either add the dep or explain why it's safe.

### Missing cleanup with early return
```typescript
// Bug: early return skips cleanup registration
useEffect(() => {
  const timer = setInterval(() => { ... }, 1000);
  if (condition) return;  // timer leaks!
  return () => clearInterval(timer);
}, []);

// Fix: always register cleanup before early return
useEffect(() => {
  if (condition) return () => {};
  const timer = setInterval(() => { ... }, 1000);
  return () => clearInterval(timer);
}, []);
```

### Async validation without abort
```typescript
// Bug: stale result overwrites fresh one
useEffect(() => {
  validateAsync(value).then(setResult);
}, [value]);

// Fix: abort on dependency change
useEffect(() => {
  const controller = new AbortController();
  validateAsync(value, controller.signal).then(setResult);
  return () => controller.abort();
}, [value]);
```

## 2. Concurrent Request Control

### Sequential await in loop
```typescript
// 500 items = 500 serial API calls = 50+ seconds
for (const addr of addresses) {
  await validateAddress(addr);
}

// Fix: concurrent with rate limiting
import pLimit from 'p-limit';
const limit = pLimit(10);
await Promise.all(addresses.map(a => limit(() => validateAddress(a))));
```

### Polling without request guard
```typescript
// Bug: requests stack up if previous one is still pending
const interval = setInterval(() => fetchData(), 1000);

// Fix: guard with ref
const isLoading = useRef(false);
const interval = setInterval(async () => {
  if (isLoading.current) return;
  isLoading.current = true;
  try { await fetchData(); }
  finally { isLoading.current = false; }
}, 1000);
```

## 3. Race Conditions & Cleanup

### State update after unmount
```typescript
// Fix: isMounted guard
useEffect(() => {
  let isMounted = true;
  fetchData().then(data => {
    if (isMounted) setState(data);
  });
  return () => { isMounted = false; };
}, []);
```

### Dialog close + navigation race (Fabric crash)
```typescript
// Bug: Fabric crash during rapid dialog close + navigation
dialog.close();
navigation.push('NextPage');  // Race with dialog unmount

// Fix: delay navigation to allow cleanup
dialog.close();
await new Promise(r => setTimeout(r, 100));
navigation.push('NextPage');
```

### WebView ref in cleanup
```typescript
// Bug: ref.current may change between render and cleanup
useEffect(() => {
  return () => {
    webviewRef.current?.stopLoading();  // May crash
  };
}, []);

// Fix: capture ref value before cleanup
useEffect(() => {
  const webview = webviewRef.current;
  return () => {
    webview?.stopLoading();
  };
}, []);
```

## 4. Stale Data

### Cache not cleared on context switch
```typescript
// Bug: old provider list shown when switching type
useEffect(() => {
  fetchProviders(type).then(setProviders);
}, [type]);

// Fix: clear before fetching
useEffect(() => {
  setProviders([]);  // Clear stale data immediately
  fetchProviders(type).then(setProviders);
}, [type]);
```

### Callback ref going stale
```typescript
// Bug: callback captured at setup time, never updates
useEffect(() => {
  const saved = onUpdate;  // Stale!
  const interval = setInterval(() => saved(getData()), 1000);
  return () => clearInterval(interval);
}, []);  // Missing onUpdate dep

// Fix: use ref for latest value
const onUpdateRef = useRef(onUpdate);
onUpdateRef.current = onUpdate;
useEffect(() => {
  const interval = setInterval(() => onUpdateRef.current(getData()), 1000);
  return () => clearInterval(interval);
}, []);
```

## 5. Debounced Async Validation

### Promise never resolves (react-hook-form hangs)
```typescript
// Bug: debounced function doesn't return promise — form waits forever
rules={{ validate: (value) => { debouncedValidate(value); return true; } }}

// Fix: return the promise, cleanup on unmount
const debouncedValidate = useCallback((value: string) => {
  return new Promise<boolean>((resolve) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      resolve(await validate(value));
    }, 300);
  });
}, [validate]);

// Cleanup
useEffect(() => () => {
  clearTimeout(timeoutRef.current);
}, []);
```

## 6. Error Handling (Non-Obvious Cases)

### Silent early return — user clicks, nothing happens
```typescript
// Bug: no feedback when validation fails
const handleSubmit = () => {
  if (!data) return;  // User sees nothing
};

// Fix: tell the user
if (!data) {
  Toast.warning({ title: 'Please fill required fields' });
  return;
}
```

### Catch swallows error in critical path
Look for `catch {}` or `catch(e) { console.error(e) }` in transaction/signing/transfer flows — these MUST surface errors to the user.
