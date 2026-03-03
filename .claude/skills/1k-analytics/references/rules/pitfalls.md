# Common Pitfalls

## 1. Calling analytics directly

**Problem:** Calling `analytics.trackEvent()` or `appGlobals.$analytics.trackEvent()` directly from business code.

**Why it's wrong:** Bypasses the logger system, loses timing/duration tracking, inconsistent with codebase patterns, harder to search and maintain.

**Fix:** Always use `defaultLogger.{scope}.{scene}.{method}(params)` with `@LogToServer()` decorator.

```typescript
// WRONG
import { analytics } from '@onekeyhq/shared/src/analytics';
analytics.trackEvent('myEvent', { key: 'value' });

// WRONG
import appGlobals from '@onekeyhq/shared/src/appGlobals';
appGlobals.$analytics?.trackEvent('myEvent', { key: 'value' });

// CORRECT
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
defaultLogger.myScope.myScene.myEvent({ key: 'value' });
```

**Exceptions:** Two legitimate direct calls exist:
- `analytics.updateUserProfile()` — for setting persistent user attributes (wallet counts), not event tracking. See [architecture.md](architecture.md#user-profile-tracking).
- Web embed `postMessage` handler — the parent WebView calls `analytics.trackEvent()` to relay events from the embedded context. Do not modify this pattern.

## 2. Mixpanel usage spikes from high-frequency events

**Problem:** Placing `@LogToServer()` events in callbacks that fire very frequently (e.g., `DEVICE.SUPPORT_FEATURES` fires on every hardware feature update, WebSocket messages, polling intervals).

**Real-world case from PR #10419 review:**
> "这个埋点有 mixpanel 用量暴增的风险，每次 features 请求都会执行一次"

**Fix:** Deduplicate with in-memory Set or flag:

```typescript
// Per-session dedup with Set
private connectedDeviceTracked = new Set<string>();

// In the callback
if (!this.connectedDeviceTracked.has(deviceId)) {
  this.connectedDeviceTracked.add(deviceId);
  defaultLogger.hardware.connection.hwDeviceConnected(params);
}
```

**Other dedup strategies:**
- **Per-session flag:** Boolean flag reset on app restart
- **Throttle:** Use `lodash.throttle` for periodic events (e.g., at most once per minute)
- **Conditional:** Only fire when state actually changes (e.g., `fromType !== toType`)

## 3. Returning Promises from scene methods

**Problem:** Scene methods decorated with `@LogToServer()` must return data synchronously. The BaseScope proxy validates this.

```typescript
// WRONG — returns a Promise
@LogToServer()
public async myEvent() {
  const data = await fetchSomething();
  return data;
}

// CORRECT — returns synchronous data
@LogToServer()
public myEvent(params: { key: string }) {
  return params;
}
```

**If you need async data in the event params:** Resolve async values before calling the logger method:

```typescript
// In business code
const deviceType = await deviceUtils.getDeviceType(features);
defaultLogger.hardware.connection.hwDeviceConnected({ deviceType });
```

## 4. Creating unnecessary new scopes

**Problem:** Creating a new scope when the event belongs to an existing domain.

**Rule:** Check `packages/shared/src/logger/logger.ts` for existing scopes. A firmware-related event should go under `update.firmware`, not a new `firmwareTracking` scope.

## 5. Forgetting to add EScopeName for new scopes

**Problem:** Creating a scope class but not adding the enum value to `EScopeName` in `packages/shared/src/logger/types.ts`.

**Fix:** Always add to both:
1. `EScopeName` enum in `types.ts`
2. `DefaultLogger` class in `logger.ts`

## 6. Logging sensitive data

**Problem:** Including private keys, mnemonics, passwords, or PII in event params.

**Rule:** Never log sensitive data in `@LogToServer()`. Only log identifiers, types, and behavioral metadata.

For `@LogToLocal()` debugging, use `devOnlyData()` to safely include error details (returns placeholder in production):

```typescript
import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

@LogToServer()
@LogToLocal({ level: 'error' })
public failToCreateTransaction(params: { error: string }) {
  return [params, devOnlyData(error)]; // full error only in dev
}
```

## 7. Inconsistent event naming

**Problem:** Using snake_case or mixing naming styles for method names.

**Rule:** Always use camelCase for method names. The method name becomes the Mixpanel event name automatically.

```typescript
// WRONG
@LogToServer()
public hw_device_connected(params: {...}) { return params; }

// CORRECT
@LogToServer()
public hwDeviceConnected(params: {...}) { return params; }
```

## Self-Check Before Submitting

- [ ] Using `@LogToServer()` decorator (not direct analytics calls)?
- [ ] Event method returns params synchronously (not a Promise)?
- [ ] High-frequency callback? Added dedup logic?
- [ ] No sensitive data (keys, addresses, passwords) in `@LogToServer()` params?
- [ ] Using `devOnlyData()` for error details in `@LogToLocal()`?
- [ ] Method name is camelCase?
- [ ] Added to existing scope/scene (not creating unnecessary new scope)?
- [ ] TypeScript types defined for all params?
- [ ] If using `@LogToLocal()`, set appropriate level (`error` for errors, `info` for normal)?
