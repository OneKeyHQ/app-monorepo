---
name: 1k-feature-guides
description: Feature development guides for OneKey. Use when adding new chains, socket events, notifications, pages, or routes. Covers blockchain integration, WebSocket subscriptions, push notifications, and navigation patterns.
---

# Feature Development Guides

Comprehensive guides for extending OneKey app functionality.

## Quick Reference

| Feature | Guide | Key Files |
|---------|-------|-----------|
| Add blockchain chain | [adding-chains.md](references/rules/adding-chains.md) | `packages/core/src/chains/` |
| Add WebSocket events | [adding-socket-events.md](references/rules/adding-socket-events.md) | `packages/shared/types/socket.ts` |
| Push notifications | [notification-system.md](references/rules/notification-system.md) | `packages/kit-bg/src/services/ServiceNotification/` |
| Pages & routes | [page-and-route.md](references/rules/page-and-route.md) | `packages/kit/src/routes/` |

## Adding New Chains

See: [references/rules/adding-chains.md](references/rules/adding-chains.md)

**Key steps:**
1. Implement chain core logic in `packages/core/src/chains/mychain/`
2. Add chain configuration in `packages/shared/src/config/chains/`
3. Update UI components for chain-specific features
4. Add comprehensive tests

**Reference implementations:**
- EVM chains: `packages/core/src/chains/evm/`
- Bitcoin: `packages/core/src/chains/btc/`
- Solana: `packages/core/src/chains/sol/`

## Adding WebSocket Events

See: [references/rules/adding-socket-events.md](references/rules/adding-socket-events.md)

**Key steps:**
1. Define event name in `EAppSocketEventNames` enum
2. Define payload type interface with `msgId: string`
3. Add event handler in `PushProviderWebSocket.initWebSocket()`
4. **Always acknowledge messages** via `ackNotificationMessage`

```typescript
this.socket.on(EAppSocketEventNames.myEvent, (payload: IMyPayload) => {
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  void this.backgroundApi.someService.handleEvent(payload);
});
```

## Notification System

See: [references/rules/notification-system.md](references/rules/notification-system.md)

**Notification modes:**
| Mode | Action |
|------|--------|
| 1 (page) | Navigate to specific page |
| 2 (dialog) | Show dialog |
| 3 (openInBrowser) | Open URL in external browser |
| 4 (openInApp) | Open URL in in-app browser |
| 5 (openInDapp) | Open URL in DApp browser |

**Key files:**
- Service: `packages/kit-bg/src/services/ServiceNotification/ServiceNotification.ts`
- Utils: `packages/shared/src/utils/notificationsUtils.ts`
- Types: `packages/shared/types/notification.ts`

## Pages & Routes

See: [references/rules/page-and-route.md](references/rules/page-and-route.md)

**Page types:**
| Type | Description |
|------|-------------|
| `modal` | Modal overlay pages |
| `stack` | Tab route pages |
| `onboarding` | Full screen onboarding pages |

**Route configuration locations:**
- Modal routes: `packages/kit/src/routes/Modal/router.tsx`
- Tab routes: `packages/kit/src/routes/Tab/router.ts`
- Onboarding: `packages/kit/src/views/Onboardingv2/router/index.tsx`

**Important:**
- ⚠️ **Never delete pages** - use redirect pattern for deprecated routes
- ⚠️ **Route paths must be unique** across the entire application
- ⚠️ **Always use `pop: true`** with `navigation.navigate`

## Related Skills

- `/1k-coding-patterns` - React and TypeScript best practices
- `/1k-architecture` - Project structure and import rules
- `/1k-state-management` - Jotai atom patterns
