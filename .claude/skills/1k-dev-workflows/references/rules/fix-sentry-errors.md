# Fix Sentry Errors

Workflow for analyzing and fixing errors from Sentry crash reports in the OneKey app-monorepo.

## Prerequisites

- Access to Sentry crash reports (JSON log files)
- Understanding of the error context (iOS/Android/Web/Extension)
- Development environment set up

## Workflow Overview

```
1. Obtain Sentry JSON log → 2. Analyze error → 3. Identify root cause → 4. Implement fix → 5. Test & verify → 6. Create PR
```

## Step 1: Obtain Sentry Error JSON Log

### Download from Sentry Dashboard

1. Navigate to Sentry project (e.g., `so.onekey.wallet`)
2. Find the error event you want to fix
3. Click on the event to view details
4. Export the full JSON data:
   - Click "JSON" tab or download option
   - Save to a local file (e.g., `<event_id>.json`)

### File Location

Save the JSON file to your Downloads folder or a temporary location:
```bash
~/Downloads/<event_id>.json
```

## Step 2: Analyze the Error

### Quick Analysis with Python

Use Python to extract key information from the JSON log:

```bash
python3 -c "
import json

with open('/path/to/<event_id>.json', 'r') as f:
    data = json.load(f)

print('=== ERROR OVERVIEW ===')
print(f'Event ID: {data.get(\"event_id\")}')
print(f'Platform: {data.get(\"platform\")}')
print(f'Release: {data.get(\"release\")}')
print(f'Message: {data.get(\"message\")}')
print(f'Datetime: {data.get(\"datetime\")}')
print()

# Extract tags
tags = dict(data.get('tags', []))
print('=== TAGS ===')
print(f'Device: {tags.get(\"device\")}')
print(f'OS: {tags.get(\"os\")}')
print(f'Level: {tags.get(\"level\")}')
print()

# Extract exception info
exception = data.get('exception', {})
if 'values' in exception:
    print('=== EXCEPTION ===')
    for exc in exception['values']:
        print(f'Type: {exc.get(\"type\")}')
        print(f'Value: {exc.get(\"value\")}')
"
```

### Key Information to Extract

| Field | Description | Example |
|-------|-------------|---------|
| `event_id` | Unique error identifier | `37b865c80c014b12...` |
| `platform` | Platform where error occurred | `cocoa`, `android`, `javascript` |
| `release` | App version | `so.onekey.wallet@5.19.3+...` |
| `tags.device` | Device model | `iPhone10,1`, `Pixel 6` |
| `tags.os` | Operating system | `iOS 16.7.11`, `Android 13` |
| `tags.mechanism` | Error type | `AppHang`, `ANR`, `Crash` |
| `exception.values` | Exception details | Type, value, stacktrace |
| `breadcrumbs` | User actions before crash | HTTP requests, navigation |
| `threads` | Thread stack traces | Main thread, background threads |

### Common Error Types

| Type | Description | Common Causes |
|------|-------------|---------------|
| **AppHang** (iOS) | App frozen for 5+ seconds | Main thread blocking, heavy computation |
| **ANR** (Android) | Application Not Responding | UI thread blocking, slow operations |
| **Crash** | App terminated unexpectedly | Null pointer, memory issues, native crashes |
| **JavaScript Error** | JS exception in Web/Extension | Undefined variables, type errors |

## Step 3: Identify Root Cause

### Analyze Stack Traces

Look at the main thread or crashed thread:

```bash
python3 -c "
import json

with open('/path/to/<event_id>.json', 'r') as f:
    data = json.load(f)

threads = data.get('threads', {}).get('values', [])

for thread in threads:
    if thread.get('main') or thread.get('crashed'):
        print(f'Thread ID: {thread.get(\"id\")}')
        print(f'Crashed: {thread.get(\"crashed\")}')
        print('\\nStack Trace (last 20 frames):')

        frames = thread.get('stacktrace', {}).get('frames', [])
        for frame in frames[-20:]:
            function = frame.get('function', 'unknown')
            filename = frame.get('filename', '')
            lineno = frame.get('lineno', '')

            if filename:
                print(f'  {function}')
                print(f'    at {filename}:{lineno}')
            else:
                print(f'  {function}')
"
```

### Analyze Breadcrumbs (User Actions)

Check what the user was doing before the crash:

```bash
python3 -c "
import json

with open('/path/to/<event_id>.json', 'r') as f:
    data = json.load(f)

breadcrumbs = data.get('breadcrumbs', {}).get('values', [])

print('Last 10 user actions:')
for bc in breadcrumbs[-10:]:
    category = bc.get('category', '')
    message = bc.get('message', '')
    timestamp = bc.get('timestamp', '')
    print(f'{timestamp} [{category}] {message}')
"
```

### Common Root Causes

| Pattern | Root Cause | Solution |
|---------|------------|----------|
| Multiple parallel network requests in breadcrumbs | Too many concurrent requests | Implement request batching/concurrency control |
| Navigation-related frames in stack trace | UI updates during navigation | Defer heavy operations, optimize rendering |
| Memory pressure warnings | Memory leak or excessive allocation | Optimize data structures, implement cleanup |
| Repeated failed API calls | Network error handling issues | Add retry logic, better error handling |

## Step 4: Implement Fix

### Common Fix Patterns

#### 1. Concurrent Request Control

**Problem**: Too many simultaneous network requests blocking UI

**Fix**: Implement batched execution with concurrency control

```typescript
// Add helper method to control concurrency
private async executeBatched<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((task) => task()),
    );
    results.push(...batchResults);
  }

  return results;
}

// Use it to replace Promise.all
// Before:
const results = await Promise.all(requests);

// After:
const tasks = requests.map(req => () => fetch(req));
const results = await this.executeBatched(tasks, 3);
```

#### 2. Main Thread Offloading

**Problem**: Heavy computation blocking UI thread

**Fix**: Use web workers (web) or background threads (mobile)

```typescript
// For React Native
import { runOnJS, runOnUI } from 'react-native-reanimated';

// Offload to background thread
runOnUI(() => {
  // Heavy computation here
  const result = processLargeData();

  // Update UI on JS thread
  runOnJS(updateUI)(result);
})();
```

#### 3. Error Boundary Addition

**Problem**: Unhandled exceptions crashing entire app

**Fix**: Add React error boundaries

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to Sentry
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

#### 4. Memory Optimization

**Problem**: Memory leaks or excessive allocations

**Fix**: Implement cleanup and optimization

```typescript
// Add cleanup in useEffect
useEffect(() => {
  const subscription = api.subscribe();

  return () => {
    subscription.unsubscribe(); // Cleanup
  };
}, []);

// Use pagination for large lists
const [items, setItems] = useState([]);
const loadMore = () => {
  // Load in chunks instead of all at once
  fetchItems(page, PAGE_SIZE).then(setItems);
};
```

## Step 5: Verify Fix

### Run Linting and Type Checks

```bash
# Lint the modified files
yarn lint:staged

# Type check (requires full project context)
yarn tsc:staged
```

### Test Locally

1. **Reproduce the issue** (if possible)
   - Follow the user actions from breadcrumbs
   - Test on similar device/OS version

2. **Verify the fix**
   - Confirm the error no longer occurs
   - Check performance improvements
   - Test edge cases

3. **Check for regressions**
   - Test related features
   - Verify no new errors introduced

## Step 6: Create PR

### Commit Message Format

```bash
fix(<scope>): <brief description>

<Detailed explanation of the issue and fix>

Changes:
- <Change 1>
- <Change 2>

Impact:
- <Impact 1>
- <Impact 2>

Analyzed from Sentry crash report: <event_id>
```

### Example Commit

```bash
git add .
git commit -m "$(cat <<'EOF'
fix(swap): prevent iOS app hang with batched token list fetching

Fixes an iOS app hang issue (5+ seconds) that occurred when fetching
token lists for multiple networks simultaneously on the Swap page.

Changes:
- Add executeBatched() method to control request concurrency (max 3 concurrent)
- Use Promise.allSettled to prevent single request failures from blocking others
- Update swapLoadAllNetworkTokenList to use batched execution
- Update swapProLoadSupportNetworksTokenList to use batched execution

Impact:
- Prevents UI thread blocking during navigation
- Improves performance on low-end iOS devices (iPhone 7, etc.)
- Better error handling for network requests

Analyzed from Sentry crash report: 37b865c80c014b12b9c3f7bf45af75ea
EOF
)"
```

### Create PR

```bash
# Create new branch
git checkout -b fix/sentry-<error-type>

# Push and create PR
git push -u origin fix/sentry-<error-type>
gh pr create --base x --title "fix: <description>" --body "<detailed description>"
```

## Best Practices

### 1. Document Your Analysis

Create a clear analysis of:
- Error context (device, OS, user actions)
- Root cause identification
- Why your fix addresses the issue
- Performance impact

### 2. Add Comments in Code

```typescript
/**
 * Execute promises in batches with concurrency control to prevent overwhelming the system
 * This fixes iOS app hangs when fetching token lists for multiple networks simultaneously
 * @param tasks - Array of promise-returning functions to execute
 * @param concurrency - Maximum number of concurrent promises (default: 3)
 * @returns Array of settled results
 */
```

### 3. Test on Target Platform

If fixing an iOS issue:
- Test on iPhone 7 or similar low-end device
- Test on the reported iOS version
- Verify fix doesn't break newer devices

### 4. Monitor After Deployment

- Track the error rate in Sentry after fix is deployed
- Verify no new related errors introduced
- Check performance metrics

## Common Sentry Error Scenarios

### Scenario 1: iOS App Hang During Navigation

**Symptoms**:
- `mechanism: AppHang`
- Stack trace shows navigation components
- Breadcrumbs show multiple API calls

**Root Cause**: Concurrent network requests blocking UI thread

**Fix**: Implement request batching (see Step 4)

### Scenario 2: Android ANR in Background

**Symptoms**:
- `mechanism: ANR`
- Stack trace shows background service
- Long-running operations

**Root Cause**: Heavy work on main thread

**Fix**: Move to background thread or use WorkManager

### Scenario 3: JavaScript Error in Web Extension

**Symptoms**:
- `platform: javascript`
- Stack trace shows specific function
- Type errors or undefined variables

**Root Cause**: Missing null checks or type guards

**Fix**: Add type guards and error handling

## Related Skills

- `/1k-git-workflow` - Git branching and commit conventions
- `/1k-coding-patterns` - Code patterns and best practices
- `/1k-sentry` - Sentry error tracking and monitoring

## Troubleshooting

### Q: JSON file is too large (300KB+)

**A**: Use Python to extract only relevant sections:
```bash
python3 -c "
import json

with open('large_file.json', 'r') as f:
    data = json.load(f)

# Extract only what you need
summary = {
    'event_id': data['event_id'],
    'exception': data.get('exception'),
    'breadcrumbs': data.get('breadcrumbs', {}).get('values', [])[-20:],
    'threads': [t for t in data.get('threads', {}).get('values', []) if t.get('main')]
}

print(json.dumps(summary, indent=2))
"
```

### Q: Can't reproduce the error locally

**A**: Check these factors:
- Device model and OS version
- Network conditions
- App state (logged in, specific account type)
- Timing (race conditions)

### Q: Fix works but introduces regression

**A**:
1. Run full test suite: `yarn test`
2. Check linting: `yarn lint:only`
3. Test related features thoroughly
4. Consider feature flag for gradual rollout
