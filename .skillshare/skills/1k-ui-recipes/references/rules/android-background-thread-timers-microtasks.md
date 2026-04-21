# Android Background Thread Missing `setTimeout` / Microtask Queue

## Symptom

On Android, any code running in the background JS thread (`@onekeyfe/react-native-background-thread`) exhibits:

- `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `requestAnimationFrame`, `requestIdleCallback` are `undefined` — calling them throws `TypeError: setTimeout is not a function`.
- `await wait(ms)` / `await new Promise(r => setTimeout(r, ms))` hangs forever.
- Even **already-resolved** promises never resolve: `await Promise.resolve()` never returns, so any `async` function that touches `await` stalls at the first `await`.
- `Promise.then()` continuations never fire; RPC handlers that return promises silently never complete, which manifests as bridge-call timeouts on the main thread.
- iOS works fine — the issue is Android-only.

## Root Cause

Two independent problems in the background Hermes runtime on Android:

### 1. No timer module wired into the background runtime

React Native's built-in timer module (`NativeTiming` / `JSTimers`) only hooks into the **main** JS runtime. When `BackgroundThreadManager` spins up a second Hermes runtime for the background thread, that runtime's `global` has no `setTimeout`, `setInterval`, `requestAnimationFrame`, or `requestIdleCallback`. Any user-land polyfill in JS can't work either, because there's no underlying native timer to schedule against.

### 2. Hermes microtask queue is never drained

React Native 0.74+ configures Hermes with an **explicit microtask queue** (`MicrotaskQueue`). On the main runtime, RN's bridge/TurboModule call site drains the queue after each JS invocation. The custom background runtime has no such caller — we dispatch work via a manual `RPCRuntimeExecutor` that calls `work(*rt)` and returns, **without** calling `rt->drainMicrotasks()`. Consequences:

- `Promise.then(cb)` enqueues `cb` into the microtask queue → never runs.
- `async function f() { await x; /* body */ }` — after `await`, the body is scheduled as a microtask → never runs.
- This includes `await Promise.resolve()` and `await 0`, not just pending promises.

The two bugs reinforce each other: even if timers worked, any `async` code would still hang at the first `await`; even if microtasks drained, any `await wait(ms)` would still hang forever.

## Fix

Both fixes live in `@onekeyfe/react-native-background-thread` at `android/src/main/cpp/cpp-adapter.cpp` (shipped in version **3.0.18**). No patch-package needed; just bump the dependency in `apps/mobile/package.json`.

### 1. Drain microtasks after every cross-runtime work execution

After the RPC executor runs a unit of work on the background runtime, explicitly drain the Hermes microtask queue. This single call makes `Promise.then`, `async`/`await`, and `queueMicrotask` behave normally.

```cpp
// cpp-adapter.cpp — nativeExecuteWork
try {
    work(*rt);
} catch (...) { /* ... */ }

// CRITICAL: Drain the Hermes microtask queue. React Native 0.74+ configures
// Hermes with an explicit microtask queue, which must be manually drained
// after each JS execution. Without this, Promise.then() / async-await
// continuations (including already-resolved promises) are never executed,
// causing all awaits to hang forever in the background runtime.
try {
    rt->drainMicrotasks();
} catch (const jsi::JSError &e) {
    LOGE("JSError draining microtasks: %s", e.getMessage().c_str());
}
```

### 2. Install JSI-level `setTimeout` / `setInterval` / `rAF` / `rIC` on the background runtime

Back timers with a single C++ worker thread that sleeps on a `condition_variable` until the next scheduled `fireAt`, then dispatches the JS callback back onto the background JS queue via the same `RPCRuntimeExecutor` used by `SharedRPC`. Install `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `requestAnimationFrame`, `cancelAnimationFrame`, `requestIdleCallback`, `cancelIdleCallback` as host functions on `runtime.global()`:

```cpp
// cpp-adapter.cpp — nativeInstallSharedBridge (isMain == false branch)
if (!capturedIsMain) {
    gBgTimerExecutor = executor;          // save before std::move into SharedRPC
}
SharedRPC::install(*rt, std::move(executor), runtimeId);
if (!capturedIsMain) {
    installTimersOnRuntime(*rt);          // setTimeout / setInterval / rAF / rIC
    invokeOptionalGlobalFunction(*rt, "__setupBackgroundRPCHandler");
}
```

Key design points in `installTimersOnRuntime`:

- **Single worker thread, not one per timer** — `timerWorkerLoop` owns a `std::unordered_map<int64_t, TimerEntry>` keyed by timer id and always sleeps until the earliest `fireAt`.
- **Erase/reschedule under the lock before dispatching** — if you wait to erase one-shot timers in the JS-thread callback, the worker's next iteration will re-find them and re-dispatch, causing an infinite flood of `scheduleOnJSThread` calls.
- **Interval uses `now + intervalMs`, not `fireAtMs + intervalMs`** — prevents an infinite catch-up backlog when the JS thread is slow.
- **`cancelTimer` marks the entry cancelled** and wakes the worker via `gTimerCv.notify_all()`; actual erase happens in the next worker loop iteration.
- **`requestAnimationFrame` ≈ `setTimeout(16ms)`** with a `DOMHighResTimeStamp`-shaped argument; the bg runtime has no rendering pipeline to be "idle between frames".
- **`requestIdleCallback` ≈ `setTimeout(1ms)`** with a minimal `IdleDeadline` stub: `{ didTimeout: false, timeRemaining: () => 50 }`.

### 3. Guard against runtime reload leaking JNI globals

The executor captures a `jobject` global ref to `BackgroundThreadManager`. Wrap it in a `std::shared_ptr<_jobject>` with a custom deleter that calls `DeleteGlobalRef`, so the ref is released when the last copy of the executor lambda dies (e.g. on fast refresh / runtime reload).

```cpp
auto ref = std::shared_ptr<_jobject>(env->NewGlobalRef(thiz), [](jobject r) {
    if (r) {
        JNIEnv *e = getJNIEnv();
        if (e) e->DeleteGlobalRef(r);
    }
});
```

## Why these specific fixes

| Attempted approach | Why it failed |
|---|---|
| Pure JS polyfill `global.setTimeout = (cb, ms) => { /* spin loop */ }` | Blocks the JS thread; no underlying scheduler exists |
| Reuse RN's main-thread `NativeTiming` via JSI | `NativeTiming` is bound to the main bridge / main runtime and has no API to target a second runtime |
| Call `setImmediate`-style via SharedRPC back to main thread | Round-trip latency kills perf; and `setTimeout(0)` inside `await` chains would still need microtask drain anyway |
| Drain microtasks inside each timer callback only | Fixes timers but leaves all non-timer async code (RPC handlers, `Promise.then` chains) broken |
| Install timers without draining microtasks | `setTimeout(resolve, 0)` still hangs: the resolution is queued as a microtask and never drained |

Both fixes are required — they address orthogonal bugs on the same code path.

## Verification checklist

In the background thread dev settings test page:

- `await timerUtils.wait(500)` returns after ~500ms (not forever).
- `await Promise.resolve(1)` returns `1` synchronously-ish (next microtask drain).
- An RPC handler declared `async` and using `await` completes on the main thread side instead of timing out.
- `setInterval(fn, 1000)` fires repeatedly; `clearInterval(id)` stops it.
- Logcat shows `Timer + rAF + rIC polyfills installed on bg runtime` at startup and does **not** show a flood of `scheduleOnJSThread` log lines.

## Key files

- `native-modules/react-native-background-thread/android/src/main/cpp/cpp-adapter.cpp` (upstream in `~/project/app-modules`) — all of the above lives here
  - `nativeExecuteWork` — adds `rt->drainMicrotasks()` after `work(*rt)`
  - `installTimersOnRuntime` — JSI-level `setTimeout` / `setInterval` / `rAF` / `rIC`
  - `timerWorkerLoop` + `scheduleTimer` / `cancelTimer` — C++ worker thread
  - `gBgTimerExecutor` — bg JS queue executor captured from `SharedRPC::install`
- `apps/mobile/package.json` — bump `@onekeyfe/react-native-background-thread` to `3.0.18`
- iOS equivalent: `BackgroundRunnerReactNativeDelegate` (uses RN's built-in timer module + default microtask handling, so no iOS patch is needed)

## Related notes

- Do **not** add a JS-land polyfill in `polyfillsPlatform.js` for this — the bug is below the JS layer, and a JS polyfill would only hide the missing microtask drain, not fix it.
- Any future code that spawns a third JSI runtime from C++ must also `drainMicrotasks()` after each work execution, or the same Promise-hang symptom will reappear.
