# Analytics Architecture

## System Overview

```
Business Code
  → defaultLogger.{scope}.{scene}.{method}(params)
    → BaseScope Proxy (intercepts call, tracks timing)
      → Scene Method (@LogToServer decorator wraps return in Metadata)
        → logFn() routes by metadata.type
          → 'server' → appGlobals.$analytics.trackEvent(methodName, params)
            → POST /utility/v1/track/event (Mixpanel)
          → 'local'  → React Native logger (device log file)
          → 'console' → console.log (dev only)
```

## Directory Structure

```
packages/shared/src/logger/
├── base/
│   ├── baseScene.ts       # Base class for all scenes
│   ├── baseScope.ts       # Proxy-based scope with scene caching
│   ├── decorators.ts      # @LogToServer, @LogToLocal, @LogToConsole
│   └── logFn.ts           # Event routing switch (server/local/console)
├── scopes/                # 30+ scope directories
│   ├── dex/
│   │   ├── index.ts       # DexScope class, registers scenes
│   │   ├── types.ts       # Event param interfaces and enums
│   │   └── scenes/
│   │       ├── banner.ts  # BannerScene (dexBannerEnter event)
│   │       ├── enter.ts
│   │       ├── swap.ts
│   │       └── ...
│   ├── hardware/
│   │   ├── index.ts
│   │   └── scenes/
│   │       ├── sdk.ts       # HardwareSDKScene
│   │       ├── homescreen.ts
│   │       ├── verify.ts
│   │       └── litecard.ts
│   └── ...
├── logger.ts              # DefaultLogger — instantiates all scopes
├── types.ts               # EScopeName enum, Metadata class, IMethodDecoratorMetadata
├── loggerConfig.ts        # Per-scope/scene enable/disable config
├── stringifyFunc.ts       # Safe argument serialization (3000 char limit)
└── extensions.ts          # React Native logger extensions
```

## Key Classes

### BaseScene (`base/baseScene.ts`)

Base class all scenes extend. Provides:
- Timestamp management (`timestamp`, `lastTimestamp`, `resetTimestamp()`)
- Duration tracking (automatic via BaseScope proxy)
- Utility methods: `consoleLog()`, `consoleError()`
- `registerRid()` — sends push notification RID to server via `@LogToServer()`

### BaseScope (`base/baseScope.ts`)

Uses **Proxy pattern** to intercept all scene method calls:
- Lazy-instantiates scene classes on first use (cached)
- Calculates `lastDuration` and `totalDuration` per method call
- Validates methods exist and don't return Promises
- Calls `logFn()` with serialized args + decorator metadata

### Decorators (`base/decorators.ts`)

Wraps scene methods to attach routing metadata:

```typescript
@LogToServer()                    // → metadata.type = 'server'
@LogToLocal({ level: 'info' })    // → metadata.type = 'local'
@LogToConsole()                   // → metadata.type = 'console'
```

Multiple decorators stack — a method with both `@LogToServer()` and `@LogToLocal()` sends to both destinations.

### logFn (`base/logFn.ts`)

Routes events based on `metadata.type` (wrapped in `setTimeout` for non-blocking):
- `'server'`: Calls `appGlobals.$analytics.trackEvent(methodName, flattenedParams)`
- `'local'`: Writes to React Native logger, handles repeat message dedup
- `'console'`: Console output (dev only, respects per-scope config)

### Analytics Service (`packages/shared/src/analytics/index.ts`)

Handles server communication:
- Caches events before initialization
- Sends `POST /utility/v1/track/event` with `{eventName, eventProps}`
- Includes device info and `distinct_id` (instance ID)
- Skips sending in dev/E2E mode (unless `enableAnalyticsInDev`)
- Web embed posts via `postMessage` to parent

## User Profile Tracking

`analytics.updateUserProfile()` is a separate API for setting persistent user attributes in Mixpanel (not events). This is intentionally called directly — NOT through the decorator system:

```typescript
import { analytics } from '@onekeyhq/shared/src/analytics';

analytics.updateUserProfile({
  walletCount: 3,
  appWalletCount: 2,
  hwWalletCount: 1,
});
```

Use this only for aggregate user attributes (wallet counts, etc.), not for behavioral events.

## Advanced Patterns

### NO_LOG_OUTPUT sentinel

Use `NO_LOG_OUTPUT` to conditionally suppress logging from within a scene method:

```typescript
import { NO_LOG_OUTPUT } from '../../../types';

@LogToLocal()
public serviceCall(params: { service: string }) {
  if (isHighFrequencyCall(params.service)) {
    return NO_LOG_OUTPUT; // suppress logging for noisy calls
  }
  return params;
}
```

### Returning arrays for multi-destination data

Scene methods can return arrays to pass different data to different decorators:

```typescript
@LogToServer()
@LogToLocal({ level: 'error' })
public failedAction(params: { type: string; error: Error }) {
  return [{ type: params.type }, devOnlyData(params.error)];
}
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Scope name | camelCase in `EScopeName` enum (may differ from class name!) | `dex`, `hardware`, `fiatCrypto` |
| Scene name | camelCase string in `createScene()` | `'banner'`, `'sdkLog'` |
| Scene class | PascalCase + `Scene` suffix | `BannerScene`, `HardwareSDKScene` |
| Scope class | PascalCase + `Scope` suffix | `DexScope`, `HardwareScope` |
| Event method | camelCase (becomes Mixpanel event name) | `dexBannerEnter`, `firmwareUpdateResult` |
| Event params | TypeScript interface with `I` prefix | `IDexBannerEnterParams` |
| Param enums | PascalCase with `E` prefix | `EEnterWay`, `ESwapType` |

## Data Flow: @LogToServer Event

1. Code calls `defaultLogger.dex.banner.dexBannerEnter({ bannerId: '123' })`
2. `BaseScope` proxy intercepts → finds/creates `BannerScene` instance
3. Calls `dexBannerEnter({ bannerId: '123' })` on the scene
4. `@LogToServer()` decorator wraps return value: `new Metadata([{ bannerId: '123' }], { type: 'server', level: 'info' })`
5. Proxy extracts metadata → calls `logFn()` with scope/scene/method names
6. `logFn()` sees `type: 'server'` → calls `appGlobals.$analytics.trackEvent('dexBannerEnter', { bannerId: '123' })`
7. Analytics service sends HTTP POST to `/utility/v1/track/event`
