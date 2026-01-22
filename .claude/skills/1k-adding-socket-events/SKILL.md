---
name: 1k-adding-socket-events
description: Adds new WebSocket event subscriptions to OneKey. Use when implementing new socket events, handling server push messages, or adding real-time data subscriptions. Socket, WebSocket, event, subscription, push, real-time.
---

# Adding WebSocket Event Subscriptions

This skill documents how to add new WebSocket event subscriptions in the OneKey app.

## Overview

WebSocket events enable real-time server-to-client communication. The pattern involves:
1. Define the event name in `EAppSocketEventNames` enum
2. Define the payload type interface
3. Add the event handler in `PushProviderWebSocket`

## Key Files

| Purpose | Location |
|---------|----------|
| Event names & payload types | `packages/shared/types/socket.ts` |
| WebSocket event handlers | `packages/kit-bg/src/services/ServiceNotification/PushProvider/PushProviderWebSocket.ts` |

## Step-by-Step Guide

### Step 1: Define Event Name

Add the new event name to `EAppSocketEventNames` in `packages/shared/types/socket.ts`:

```typescript
export enum EAppSocketEventNames {
  notification = 'notification',
  ping = 'ping',
  pong = 'pong',
  ack = 'ack',
  market = 'market',
  primeConfigChanged = 'CONFIG_CHANGE',
  // ... existing events
  myNewEvent = 'MY_NEW_EVENT',  // Add your new event
}
```

**Convention**: Use camelCase for the enum key, SCREAMING_SNAKE_CASE for the string value.

### Step 2: Define Payload Type

Add the payload interface in `packages/shared/types/socket.ts`:

```typescript
export interface IMyNewEventPayload {
  msgId: string;  // Required for acknowledgment
  // Add other fields as needed
  someData?: string;
  someNumber?: number;
}
```

**Important**: Always include `msgId: string` for message acknowledgment.

### Step 3: Add Event Handler

In `packages/kit-bg/src/services/ServiceNotification/PushProvider/PushProviderWebSocket.ts`:

1. Import the new payload type:

```typescript
import type {
  // ... existing imports
  IMyNewEventPayload,
} from '@onekeyhq/shared/types/socket';
```

2. Add the event handler in `initWebSocket()` method:

```typescript
this.socket.on(EAppSocketEventNames.myNewEvent, (payload: IMyNewEventPayload) => {
  // 1. Acknowledge receipt (required for most events)
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });

  // 2. Handle the event (call appropriate service method)
  void this.backgroundApi.someService.handleMyNewEvent(payload);
});
```

## Complete Example: userInfoUpdated Event

Here's a real example from the codebase:

### 1. Event Name (socket.ts)

```typescript
export enum EAppSocketEventNames {
  // ... other events
  userInfoUpdated = 'USER_INFO_UPDATED',
}
```

### 2. Payload Type (socket.ts)

```typescript
export interface IUserInfoUpdatedPayload {
  msgId: string;
}
```

### 3. Event Handler (PushProviderWebSocket.ts)

```typescript
this.socket.on(EAppSocketEventNames.userInfoUpdated, (payload: IUserInfoUpdatedPayload) => {
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
});
```

## Event Handler Patterns

### Simple Acknowledgment + Action

```typescript
this.socket.on(EAppSocketEventNames.myEvent, (payload: IMyPayload) => {
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  void this.backgroundApi.someService.doSomething();
});
```

### With Logging

```typescript
this.socket.on(EAppSocketEventNames.myEvent, (payload: IMyPayload) => {
  defaultLogger.notification.websocket.consoleLog(
    'WebSocket received myEvent:',
    payload,
  );
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  void this.backgroundApi.someService.doSomething(payload);
});
```

### With Validation

```typescript
this.socket.on(EAppSocketEventNames.myEvent, async (payload: IMyPayload) => {
  if (!payload?.requiredField) {
    console.error('myEvent ERROR: requiredField is missing', payload);
    return;
  }
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  await this.backgroundApi.someService.doSomething(payload);
});
```

### With EventBus Emission

```typescript
this.socket.on(EAppSocketEventNames.myEvent, (payload: IMyPayload) => {
  void this.backgroundApi.serviceNotification.ackNotificationMessage({
    msgId: payload.msgId,
    action: ENotificationPushMessageAckAction.arrived,
  });
  appEventBus.emit(EAppEventBusNames.MyEventReceived, payload);
});
```

## Important: Message Acknowledgment

**You MUST acknowledge messages via `serviceNotification.ackNotificationMessage`**. If you don't acknowledge the `msgId`, the server will assume the message was not delivered and will retry sending it repeatedly.

```typescript
void this.backgroundApi.serviceNotification.ackNotificationMessage({
  msgId: payload.msgId,
  action: ENotificationPushMessageAckAction.arrived,
});
```

This should be called as early as possible in your event handler to prevent duplicate message delivery.

## Acknowledgment Actions

Available actions in `ENotificationPushMessageAckAction`:
- `arrived` - Message was received (use this for most cases)
- `clicked` - User clicked the notification

## Checklist

- [ ] Event name added to `EAppSocketEventNames` enum
- [ ] Payload interface defined with `msgId: string`
- [ ] Payload type imported in `PushProviderWebSocket.ts`
- [ ] Event handler added in `initWebSocket()` method
- [ ] **Message acknowledged via `ackNotificationMessage`** (required to prevent server retries)
- [ ] Appropriate service method called to handle the event
- [ ] Logging added if needed for debugging
