---
name: 1k-analytics
description: OneKey analytics and server event tracking with LogToServer, logger scopes/scenes, and business metrics. Use for 埋点, analytics, or tracking events.
allowed-tools: Read, Grep, Glob
---

# Analytics Event Tracking

OneKey uses a decorator-based logger system to track user behavior events. Events are routed to the analytics server (Mixpanel) via `@LogToServer()` decorator on scene methods. **NEVER** call `analytics.trackEvent()` directly.

## Quick Reference

| Topic           | Guide                                                 | Key Files                            |
| --------------- | ----------------------------------------------------- | ------------------------------------ |
| Adding events   | [adding-events.md](references/rules/adding-events.md) | `packages/shared/src/logger/scopes/` |
| Architecture    | [architecture.md](references/rules/architecture.md)   | `packages/shared/src/logger/base/`   |
| Common pitfalls | [pitfalls.md](references/rules/pitfalls.md)           | —                                    |

## Critical Rules

1. **MUST use `@LogToServer()` decorator** — never call `analytics.trackEvent()` directly
2. **Event method names use camelCase** — the method name becomes the event name sent to Mixpanel
3. **Methods MUST return params synchronously** — never return a Promise
4. **Deduplicate high-frequency events** — prevent Mixpanel usage spikes (e.g., use in-memory Set for per-session dedup)
5. **Add events to existing scopes when possible** — only create new scopes for entirely new feature domains

## Adding a Server Event (Quick Steps)

### 1. Create or update a Scene class

```typescript
// packages/shared/src/logger/scopes/{scope}/scenes/{scene}.ts
import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class MyScene extends BaseScene {
  @LogToServer()
  public myEventName(params: { key: string; value: string }) {
    return params;
  }
}
```

### 2. Register scene in scope index

```typescript
// packages/shared/src/logger/scopes/{scope}/index.ts
import { MyScene } from './scenes/myScene';

export class MyScope extends BaseScope {
  protected override scopeName = EScopeName.myScope;
  myScene = this.createScene('myScene', MyScene);
}
```

### 3. Call from business code

```typescript
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

defaultLogger.myScope.myScene.myEventName({ key: 'foo', value: 'bar' });
```

## Decorator Types

| Decorator         | Destination                            | Use Case                                 |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| `@LogToServer()`  | Mixpanel analytics server              | User behavior tracking, business metrics |
| `@LogToLocal()`   | Device local log (React Native logger) | Debugging, device-side diagnostics       |
| `@LogToConsole()` | Console only                           | Dev-time debugging                       |

Stack decorators for dual logging: `@LogToServer()` + `@LogToLocal()`.

## Related Skills

- `/1k-architecture` — Import hierarchy rules (logger is in `@onekeyhq/shared`)
- `/1k-coding-patterns` — TypeScript and React conventions
