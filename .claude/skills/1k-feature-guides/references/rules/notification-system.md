# Notification System

This guide documents the OneKey push notification implementation across all platforms.

## Platform Support Matrix

| Platform | Offline Push | Notification Bar | Click Navigation | In-App Toast |
|----------|-------------|------------------|------------------|--------------|
| iOS | ✅ JPush | ✅ | ✅ | ✅ |
| Android | ✅ JPush | ✅ | ✅ | ✅ |
| Desktop macOS | ❌ | ✅ | ✅ | ✅ |
| Desktop Windows | ❌ | ✅ | ❌ | ✅ |
| Desktop Linux | ❌ | ✅ | ❌ | ✅ |
| Extension | ⚠️ (browser alive) | ✅ | ✅ | ✅ |
| Web | ❌ | ✅ | ✅ | ✅ |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Push Sources                                  │
├─────────────────────┬───────────────────────────────────────────┤
│      JPush          │           WebSocket                        │
│  (iOS/Android)      │    (All platforms)                        │
└─────────────────────┴───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ServiceNotification                                 │
│  packages/kit-bg/src/services/ServiceNotification/              │
│  - onNotificationReceived                                        │
│  - onNotificationClicked                                         │
│  - handleColdStartByNotification                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              notificationsUtils                                  │
│  packages/shared/src/utils/notificationsUtils.ts                │
│  - navigateToNotificationDetail                                  │
│  - parseNotificationPayload                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      Transaction        App Events         Direct
        Detail         (EventBus)        Navigation
```

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Notification service | `packages/kit-bg/src/services/ServiceNotification/ServiceNotification.ts` |
| Navigation utilities | `packages/shared/src/utils/notificationsUtils.ts` |
| Notification types | `packages/shared/types/notification.ts` |
| Cold start (native) | `packages/kit/src/provider/Container/NotificationHandlerContainer/hooks.native.ts` |
| Cold start (other) | `packages/kit/src/provider/Container/NotificationHandlerContainer/hooks.ts` |
| Event handlers | `packages/kit/src/provider/Container/NotificationHandlerContainer/index.tsx` |
| In-app toast | `packages/kit/src/provider/Container/InAppNotification/index.tsx` |
| Toast component | `packages/components/src/actions/Toast/index.tsx` |
| **Payload test UI** | `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/NotificationPayloadTest.tsx` |

---

## Dev Settings: Notification Payload Test

Location: `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/NotificationPayloadTest.tsx`

A developer tool for testing notification payload parsing and navigation without sending actual push notifications.

### Access Path

Settings → Dev Settings → Notification Payload Test

### Features

- **Mode Selection**: Dropdown to select notification mode (1-5)
- **Payload Editor**: Text area to input/edit JSON or URL payload
- **Load Example**: Button to load default example payload for selected mode
- **Test Button**: Calls `parseNotificationPayload` directly to test navigation

### Default Example Payloads

```typescript
const payloadExamples = {
  // Mode 1: Page Navigation - Navigate to modal
  [ENotificationPushMessageMode.page]: {
    screen: 'modal',
    params: {
      screen: 'SettingModal',
      params: {
        screen: 'SettingPerpUserConfig',
      },
    },
  },

  // Mode 2: Dialog
  [ENotificationPushMessageMode.dialog]: {
    title: 'Test Dialog',
    description: 'This is a test dialog from notification payload.',
    confirmButtonProps: { text: 'Confirm' },
    cancelButtonProps: { text: 'Cancel' },
    onConfirm: {
      actionType: 'openInBrowser',
      payload: 'https://onekey.so',
    },
  },

  // Mode 3: Open in Browser
  [ENotificationPushMessageMode.openInBrowser]: 'https://onekey.so',

  // Mode 4: Open in App
  [ENotificationPushMessageMode.openInApp]: 'https://onekey.so/support',

  // Mode 5: Open in DApp
  [ENotificationPushMessageMode.openInDapp]: 'https://app.uniswap.org',
};
```

---

## Notification Modes

```typescript
export enum ENotificationPushMessageMode {
  page = 1,        // Navigate to a specific page
  dialog = 2,      // Show a dialog
  openInBrowser = 3,  // Open URL in external browser
  openInApp = 4,      // Open URL in in-app browser
  openInDapp = 5,     // Open URL in DApp browser
}
```

### Mode Handlers

| Mode | Event/Action | Handler Location |
|------|--------------|------------------|
| `page` (1) | `EAppEventBusNames.ShowNotificationPageNavigation` | `NotificationHandlerContainer/index.tsx:104-121` |
| `dialog` (2) | `EAppEventBusNames.ShowNotificationViewDialog` | `NotificationHandlerContainer/index.tsx:64-99` |
| `openInBrowser` (3) | `openUrlExternal(payload)` | Direct call |
| `openInApp` (4) | `openUrlInApp(payload)` | Direct call |
| `openInDapp` (5) | `EAppEventBusNames.ShowNotificationInDappPage` | `NotificationHandlerContainer/index.tsx:122-140` |

---

## Backend Configuration Guide

### Notification Message Structure

```typescript
interface INotificationPushMessageExtras {
  msgId: string;
  miniBundlerVersion?: string;  // Minimum app version required
  mode?: ENotificationPushMessageMode;  // 1-5
  payload?: string;  // JSON string or URL
  topic: ENotificationPushTopicTypes;
  image?: string;  // Image URL for notification
  params: {
    msgId: string;
    accountAddress: string;
    accountId: string;
    networkId: string;
    transactionHash: string;
  };
}
```

### Mode Configuration Examples

#### Mode 1: Page Navigation

```json
{
  "mode": 1,
  "payload": "{\"screen\":\"Modal\",\"params\":{\"screen\":\"SettingsModal\",\"params\":{\"screen\":\"SettingsPage\"}}}"
}
```

**Payload supports local param replacement:**
```json
{
  "screen": "Modal",
  "params": {
    "screen": "EarnModal",
    "params": {
      "screen": "EarnDetail",
      "params": {
        "networkId": "evm--1",
        "accountId": "{local_accountId}"
      }
    }
  }
}
```

Available local params:
- `{local_accountId}` - Current account ID
- `{local_indexedAccountId}` - Current indexed account ID
- `{local_networkId}` - Current network ID
- `{local_walletId}` - Current wallet ID

#### Generate All Available Routes

Run the following command to generate a complete list of all navigable routes:

```bash
npx tsx development/scripts/extract-routes.ts
```

This will generate:
- `build/routes/ROUTES.md` - Markdown documentation with all routes and their parameters
- `build/routes/routes.json` - JSON format for programmatic access

#### Mode 2: Dialog

```json
{
  "mode": 2,
  "payload": "{\"title\":\"Update Available\",\"description\":\"A new version is available.\",\"onConfirm\":{\"actionType\":\"openInBrowser\",\"payload\":\"https://onekey.so\"}}"
}
```

#### Mode 3: Open in External Browser

```json
{
  "mode": 3,
  "payload": "https://onekey.so/blog/announcement"
}
```

#### Mode 4: Open in In-App Browser

```json
{
  "mode": 4,
  "payload": "https://onekey.so/support"
}
```

#### Mode 5: Open in DApp Browser

```json
{
  "mode": 5,
  "payload": "https://app.uniswap.org"
}
```

---

## Cold Start Notification Handling

### Native Platforms (iOS/Android)

Location: `packages/kit/src/provider/Container/NotificationHandlerContainer/hooks.native.ts`

The `useInitialNotification` hook handles app cold start via notification:

```typescript
export const useInitialNotification = () => {
  const coldStartRef = useRef(true);

  useEffect(() => {
    setTimeout(async () => {
      if (coldStartRef.current) {
        coldStartRef.current = false;

        // 1. Check ColdStartByNotification (JPush)
        const options = ColdStartByNotification.launchNotification;
        if (options) {
          void backgroundApiProxy.serviceNotification.handleColdStartByNotification({
            notificationId: options.msgId,
            params: { /* notification details */ },
          });
          return;
        }

        // 2. Check LaunchOptionsManager (local/remote notifications)
        const launchOptions = await launchOptionsManager.getLaunchOptions();
        if (launchOptions?.localNotification || launchOptions?.remoteNotification) {
          const userInfo = launchOptions.localNotification?.userInfo
            || launchOptions.remoteNotification?.userInfo;
          await handleShowNotificationDetail({
            message: userInfo,
            notificationId: userInfo?.extras?.params?.msgId,
            mode: userInfo?.extras?.mode,
            payload: userInfo?.extras?.payload,
          });
        }
      }
    }, 350);
  }, []);
};
```

### Non-Native Platforms

Cold start handling is not needed for web/desktop/extension as:
- Web: Notifications don't persist across page reloads
- Desktop: App opens fresh, WebSocket reconnects
- Extension: Background script maintains state

---

## In-App Notification Toast

Location: `packages/kit/src/provider/Container/InAppNotification/index.tsx`

### When It Triggers

In-app notifications show when:
- WebSocket notification is received (`pushSource === 'websocket'`)
- Platform is NOT iOS native (iOS uses native notification center)

### Toast.notification Props

```typescript
interface IToastNotificationProps {
  title: string;
  message?: string;
  icon?: IKeyOfIcons;
  iconImageUri?: string;  // Custom icon image
  imageUri?: string;      // Large image on right
  duration?: number;      // Default: 5000ms
  onPress?: () => void;   // Click handler
  onClose?: () => void;   // Close callback
}
```

---

## Event Bus Events

| Event Name | Trigger | Handler |
|------------|---------|---------|
| `ShowInAppPushNotification` | WebSocket notification received | `InAppNotification/index.tsx` |
| `ShowNotificationPageNavigation` | Mode 1 payload parsed | `NotificationHandlerContainer/index.tsx` |
| `ShowNotificationViewDialog` | Mode 2 payload parsed | `NotificationHandlerContainer/index.tsx` |
| `ShowNotificationInDappPage` | Mode 5 payload parsed | `NotificationHandlerContainer/index.tsx` |
| `ShowFallbackUpdateDialog` | Version mismatch | `NotificationHandlerContainer/index.tsx` |
| `UpdateNotificationBadge` | Badge count change | Various UI components |
