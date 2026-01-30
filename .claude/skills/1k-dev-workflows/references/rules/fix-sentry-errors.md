# Fix Sentry Errors

Workflow for analyzing and fixing errors from Sentry crash reports in the OneKey app-monorepo.

## Prerequisites

- Access to Sentry crash reports (JSON log files)
- Understanding of the error context (iOS/Android/Web/Extension)
- Development environment set up

## Workflow Overview

```
1. Obtain Sentry JSON log
   ↓
2. Analyze error
   ↓
3. Identify root cause
   ↓
4. Generate bug analysis log
   ↓
🚨 WAIT FOR USER CONFIRMATION 🚨
   ↓
5. Implement fix (only after approval)
   ↓
6. Test & verify
   ↓
7. Create PR
```

**CRITICAL REQUIREMENTS**:

1. ✅ **Always create a bug analysis log** in `node_modules/.cache/bugs/` directory before implementing fixes
2. 🚨 **MUST wait for user confirmation** before starting any code changes
3. ✅ **Bug analysis must be complete** with all sections filled

**What the bug analysis log provides**:
- Traceable evidence of the issue
- Clear documentation of root cause analysis
- Strong association with error locations in code
- Proof of correct problem identification
- Reference for future similar issues

**Why wait for confirmation**:
- Prevents implementing wrong solutions
- Ensures correct problem understanding
- Allows team discussion and alternative approaches
- Creates accountability and proper workflow

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

## Step 4: Generate Bug Analysis Log

**CRITICAL**: Before implementing any fix, create a comprehensive bug analysis document in the `node_modules/.cache/bugs/` directory.

### Create Bug Analysis Directory (if not exists)

```bash
mkdir -p node_modules/.cache/bugs
```

**Note**: This directory is in `.gitignore` by default (under `node_modules/`), so bug analysis logs won't be committed to the repository. They serve as local documentation during development.

### Bug Analysis Document Structure

Create a file: `node_modules/.cache/bugs/<descriptive-name>-<event_id_short>.md`

**Examples**:
- `node_modules/.cache/bugs/logger-undefined-crash-6db69603.md` (Logger crash case)
- `node_modules/.cache/bugs/ios-app-hang-swap-token-fetch-37b865c8.md` (App hang case)

### Required Sections

```markdown
# Bug Analysis: [Brief Title]

**Sentry Event ID**: `<full_event_id>`
**Date**: YYYY-MM-DD
**Severity**: Critical/High/Medium/Low
**Platform**: iOS/Android/Web/Extension
**Affected Version**: x.y.z

## 1. Error Overview

| Field | Value |
|-------|-------|
| Error Type | AppHang/ANR/Crash/JS Error |
| Device | iPhone X, Pixel 6, etc. |
| OS Version | iOS 16.7.11, Android 13, etc. |
| Occurrence Time | 2026-01-30 04:01:42 UTC |
| User Impact | App freeze, crash, data loss, etc. |

## 2. Error Details

### Exception Information
```
[Paste exception type, value, and key details]
```

### Stack Trace (Main Thread/Crashed Thread)
```
[Paste relevant stack trace showing the crash location]
```

**Key Frames** (with file locations):
- Frame 1: `packages/kit/src/path/file.ts:123` - Function name
- Frame 2: `packages/kit/src/path/file.ts:456` - Function name

## 3. User Actions (Breadcrumbs)

What the user was doing before the crash:
```
- 04:01:35 [navigation] Navigated to Swap page
- 04:01:37 [http] GET /tokens?network=evm--1 (200 OK)
- 04:01:37 [http] GET /tokens?network=evm--56 (200 OK)
- 04:01:37 [http] GET /tokens?network=evm--137 (200 OK)
... [10+ concurrent requests]
```

## 4. Root Cause Analysis

**🔗 CRITICAL REQUIREMENT**: 根本原因分析必须**环环相扣，逐步递进**

- ✅ 每个证据都要建立在前一个证据的基础上
- ✅ 逻辑推理必须从一个点自然流向下一个点
- ✅ 形成完整的证据链，不能有跳跃或断层
- ✅ 每一步结论都要有代码或数据支撑

**Poor Example** (❌ 跳跃式分析):
```
1. 用户切换 Passphrase
2. Logger 是 undefined
3. 应用崩溃
```
*问题: 缺少中间步骤，无法证明因果关系*

**Good Example** (✅ 环环相扣):
```
1. 用户切换 Passphrase → 触发 SDK deviceSettings 调用 [Evidence: Stack trace]
2. SDK 处理设置 → 可能导致设备断开重连 [Evidence: Breadcrumbs]
3. 断开事件触发 → 调用 disconnectListener [Evidence: Code at line X]
4. 同时 SDK dispose 可能在执行 → 清理内部状态 [Evidence: Lifecycle code]
5. Logger 实例被清理或未初始化 → Log$b = undefined [Evidence: getLogger return]
6. 事件处理器仍尝试记录日志 → Log$b.debug() [Evidence: Crash line]
7. 访问 undefined 的属性 → TypeError crash [Evidence: Sentry log]
```
*每一步都有证据支撑，逻辑连贯*

### Problem Identification
[Detailed explanation of what caused the issue - be specific and technical]

Example:
```
In hardware device disconnect scenarios, the @onekeyfe/hd-core SDK attempts to call
logger.debug() but the logger object may be undefined in certain edge cases, causing
a "Cannot read property 'debug' of undefined" crash.
```

### Call Chain (Recommended)
Visualize the execution flow leading to the error:
```
User Action: Toggle Passphrase switch
    ↓
Update device settings: ServiceHardware.setPassphraseEnabled()
    ↓
SDK processing: sdk.deviceSettings({ usePassphrase: true })
    ↓
Device disconnect event triggered
    ↓
App listener: ExternalControllerEvm.disconnectListeners[accountId]
    ↓
Call: serviceDappSide.disconnectExternalWallet()
    ↓
SDK internal: Attempt to log message
    ↓
Error: Log$b.debug(...) → Log$b is undefined
    ↓
💥 Crash: Cannot read property 'debug' of undefined
```

### Source Code Evidence (CRITICAL - Must Include)

**⚠️ IMPORTANT**: Provide actual source code locations with line numbers as proof.

#### Evidence 1: Logger Class Definition
**Location**: `@onekeyfe/hd-core/dist/index.js:831-838`

```javascript
class Log$g {
    debug(...args) {  // ← debug is a method of Log$g class
        this.addMessage('debug', this.prefix, ...args);
        sendLogMessage(this.prefix, ...args);
        if (!this.enabled) return;
        console.log(this.prefix, ...args);
    }
}
```

#### Evidence 2: Logger Access Pattern
**Location**: `@onekeyfe/hd-core/dist/index.js:936`

```javascript
const getLogger = (key) => LoggerMap[key];  // ← May return undefined
```

#### Evidence 3: Logger Usage
**Location**: `@onekeyfe/hd-core/dist/index.js:27063`

```javascript
if (DataManager.getSettings('env') === 'react-native') {
    Log$b.debug('_filterCommonTypes: ', JSON.stringify(res));  // ← Direct call
} else {
    Log$b.debug('_filterCommonTypes: ', res);
}
// ⚠️ No null check - will crash if Log$b is undefined
```

### Why This Causes the Error
[Explain the technical reason with evidence]

**Race Condition Analysis**:
```
Thread 1: User Operation          Thread 2: SDK Internal
─────────────────────             ──────────────────────
User toggles Passphrase
    ↓
Call sdk.deviceSettings()    ──→  Device starts processing
    ↓                               ↓
May switch transport type         Device processing...
(BLE ⇄ USB)                         ↓
    ↓                              Settings updated
resetHardwareSDKInstance()          ↓
    ↓                              Disconnect event triggered
HardwareSDK = undefined             ↓
    ↓                              disconnectListeners called
SDK partially cleaned               ↓
                                   Try to access logger
                                   ↓
                               ❌ logger may be undefined
```

**Root cause**:
- SDK dispose process may partially clean internal state
- Async disconnect events may still be in processing queue
- Event handler code may try to access cleaned-up context
- `Log$b.debug()` crashes when `Log$b` is undefined

### Impact Scope
- **Affected Users**: All iOS users using hardware devices
- **Frequency**: Rare (~0.01% of sessions, race condition dependent)
- **Severity**: High - App crash, potential data loss
- **Platform**: iOS React Native (primary), possibly Android

## 5. Proposed Solution

### Fix Strategy
[Describe the approach to fix the issue]

Example:
1. Implement batched request execution
2. Limit concurrent requests to 3 per batch
3. Use `Promise.allSettled` to handle failures gracefully

### Code Changes Required

**File**: `packages/kit/src/states/jotai/contexts/swap/actions.ts`

**Add helper method** (Line ~122):
```typescript
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
```

**Update method** (Line 1803-1820):
```typescript
// Before:
const requests = accountAddressList.map(...);
await Promise.all(requests);

// After:
const tasks = accountAddressList.map((...) => () => fetchData(...));
const results = await this.executeBatched(tasks, 3);
```

### Expected Outcome
- ✅ UI thread no longer blocked
- ✅ Smooth navigation animations
- ✅ Better error handling
- ✅ Improved performance on low-end devices

## 6. Testing Plan

### Manual Testing
- [ ] Test on iPhone 7 (iOS 16.7.11)
- [ ] Rapidly switch between networks on Swap page
- [ ] Verify no app freeze or hang
- [ ] Test with poor network conditions

### Automated Testing
- [ ] Run `yarn lint:staged`
- [ ] Run `yarn tsc:staged`
- [ ] Verify no regressions in related tests

### Performance Metrics
- Before: 5000ms+ hang time
- After: <100ms response time (expected)

## 7. Related Issues

- Sentry Event: `37b865c80c014b12b9c3f7bf45af75ea`
- Similar pattern in `swapProLoadSupportNetworksTokenList` (also needs fix)
- Related to issue OK-XXXXX (if applicable)

## 8. Prevention

To prevent similar issues in the future:
- ✅ Always use batched execution for multiple network requests
- ✅ Set concurrency limits for parallel operations
- ✅ Test on low-end devices during development
- ✅ Monitor Sentry for similar patterns

## 9. References

- Stack Overflow: [Link if applicable]
- React Native docs: [Link if applicable]
- Internal documentation: [Link if applicable]
```

### Example Command to Create File

```bash
cat > node_modules/.cache/bugs/logger-undefined-crash-6db69603.md << 'EOF'
[Paste the bug analysis content here]
EOF
```

### Real-World Example

**Complete bug analysis document**: [`bug-analysis-logger-undefined-crash.md`](../../../../Downloads/bug-analysis-logger-undefined-crash%20(1).md)

This is an actual bug analysis from production that demonstrates:
- ✅ Comprehensive error analysis with Sentry Event ID
- ✅ Clear reproduction steps and user impact assessment
- ✅ Detailed root cause analysis with code evidence
- ✅ Source code location references with line numbers
- ✅ Call chain visualization showing the error flow
- ✅ Both application-layer fixes and SDK-layer recommendations
- ✅ Complete testing plan and follow-up actions

**Key characteristics of this example**:
1. **Third-party SDK issue**: Logger undefined in `@onekeyfe/hd-core`
2. **Detailed evidence**: Multiple source code locations with line numbers
3. **Root cause**: Race condition during SDK cleanup
4. **Fix approach**: Defensive error handling at application boundaries
5. **Prevention**: Recommendations for SDK maintainers

**What makes this a good analysis**:
- Strong association between error and code location (provable)
- Clear explanation of why the error occurs (race condition)
- Both immediate fixes and long-term improvements
- Includes sample issue template for SDK maintainers

### Verification Checklist

Before proceeding to implement the fix, verify your bug analysis includes:

- [ ] **Sentry Event ID** - Full event ID for traceability
- [ ] **Exact file locations** - Full file paths with line numbers (e.g., `file.ts:123-145`)
- [ ] **Code snippets** - Actual problematic code quoted from files with line numbers
- [ ] **Strong association** - Direct link between error and code location (provable)
- [ ] **🔗 Evidence chain** - Root cause analysis must be interlocking and progressive:
  - [ ] Each evidence builds on the previous one
  - [ ] Logic flows naturally without gaps
  - [ ] Complete chain from user action to crash
  - [ ] Every conclusion supported by code or data
- [ ] **Call chain visualization** - Shows execution flow leading to error
- [ ] **Race condition analysis** - If applicable, show timing issues
- [ ] **Root cause explanation** - Technical reasoning with evidence, not just symptoms
- [ ] **Proposed solution** - Specific code changes with examples
- [ ] **Testing plan** - How to verify the fix works
- [ ] **Prevention measures** - How to avoid similar issues

### Benefits of Bug Analysis Logs

1. **Traceable Evidence**: Clear record of issue investigation
2. **Knowledge Sharing**: Team members can learn from past issues
3. **Pattern Recognition**: Identify recurring problems
4. **Review Reference**: Useful during PR reviews
5. **Documentation**: Helpful for onboarding and maintenance

### 🚨 CRITICAL: Wait for User Confirmation

**DO NOT proceed to Step 5 (Implement Fix) until:**

1. ✅ Bug analysis log is complete and comprehensive
2. ✅ All sections are filled out with accurate information
3. ✅ Code locations are verified and correct
4. ✅ Root cause analysis is clear and well-reasoned
5. ✅ **User has reviewed and confirmed** the bug analysis

**Why this is critical:**
- Ensures correct problem identification before spending time on fixes
- Prevents implementing wrong solutions
- Allows team discussion and alternative approaches
- Creates accountability and traceability

**Workflow:**
```bash
# 1. Create bug analysis log
vim node_modules/.cache/bugs/issue-description-<event_id_short>.md

# 2. Share the analysis log path with user
# "I've created a bug analysis log at:
# node_modules/.cache/bugs/issue-description-<event_id_short>.md
#
# Please review the analysis and confirm before I proceed with the fix."

# 3. WAIT for user confirmation
# Do NOT start coding until user says "proceed" or "approved"

# 4. Only after confirmation, proceed to implement fix
```

**Note**: Bug analysis logs in `node_modules/.cache/bugs/` are not committed to git (they're in .gitignore). They serve as local documentation during the fix development process. The analysis is included in the PR description instead.

## Step 5: Implement Fix

**PREREQUISITE**: Bug analysis log must be completed and user-approved (Step 4).

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

## Step 6: Verify Fix

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

## Step 7: Create PR

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
