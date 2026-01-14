---
name: notification-system
description: Documents OneKey push notification system across platforms. Use when implementing notification features, handling notification clicks, configuring backend payloads, or understanding cold start navigation. Notification, push, toast, JPush, WebSocket.
---

# Notification System

This skill documents the OneKey push notification implementation across all platforms.

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
  // Alternative: Navigate to main tab
  // {
  //   screen: 'main',
  //   params: {
  //     screen: 'Discovery',
  //     params: {
  //       screen: 'TabDiscovery',
  //     },
  //   },
  // },

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

### Usage

1. Open Dev Settings in the app
2. Find "Notification Payload Test" section
3. Select the notification mode you want to test
4. Edit the payload JSON/URL as needed
5. Click "Test parseNotificationPayload" to trigger the navigation

This is useful for:
- Testing new navigation routes before backend integration
- Debugging notification payload formats
- Verifying dialog configurations

---

## Notification Click Flow

### onNotificationClicked (ServiceNotification.ts:243-288)

When a notification is clicked:

```typescript
onNotificationClicked = async ({
  notificationId,
  params,
  webEvent,
  eventSource,
}: INotificationClickParams) => {
  // 1. Skip if notificationId is empty (Huawei HarmonyOS edge case)
  if (!notificationId) return;

  // 2. Mark as shown to prevent duplicates
  this.addShowedNotificationId(notificationId);

  // 3. Acknowledge notification (for analytics/server sync)
  void this.ackNotificationMessage({
    msgId: notificationId,
    action: ENotificationPushMessageAckAction.clicked,
    remotePushMessageInfo: params?.remotePushMessageInfo,
  });

  // 4. Show and focus the app
  await (await this.getNotificationProvider()).showAndFocusApp();

  // 5. Wait for app to open, then navigate
  await timerUtils.wait(400);
  await notificationsUtils.navigateToNotificationDetail({
    message: params?.remotePushMessageInfo,
    isFromNotificationClick: true,
    notificationId: notificationId || '',
    notificationAccountId: params?.remotePushMessageInfo?.extras?.params?.accountId,
    mode: params?.remotePushMessageInfo?.extras?.mode,
    payload: params?.remotePushMessageInfo?.extras?.payload,
  });

  // 6. Remove notification from notification center
  void this.removeNotification({ notificationId, desktopNotification });
};
```

---

## navigateToNotificationDetail Logic

Location: `packages/shared/src/utils/notificationsUtils.ts:175-315`

### Function Signature

```typescript
async function navigateToNotificationDetail({
  notificationId,
  notificationAccountId,
  message,
  isFromNotificationClick,
  navigation,
  mode,
  payload,
  topicType,
  isRead = false,
}: INavigateToNotificationDetailParams)
```

### Navigation Decision Tree

```
                    ┌─────────────────┐
                    │ Has mode set?   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ Yes                         │ No
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────────┐
    │parseNotification│           │ Has transactionHash │
    │    Payload      │           │    in extras?       │
    └─────────────────┘           └──────────┬──────────┘
                                             │
                                  ┌──────────┴──────────┐
                                  │ Yes                 │ No
                                  ▼                     ▼
                        ┌─────────────────┐   ┌─────────────────┐
                        │  Navigate to    │   │ Navigate to     │
                        │HistoryDetails   │   │ NotificationList│
                        │    modal        │   │    (default)    │
                        └─────────────────┘   └─────────────────┘
```

### Key Logic

1. **Log analytics** (if not already read)
2. **Check current route** - If already in NotificationsModal, just update
3. **Transaction notifications**: Navigate to `HistoryDetails` modal with transaction params
4. **Mode-based navigation**: Call `parseNotificationPayload` if mode is set
5. **Default behavior**: Navigate to `NotificationList`

---

## parseNotificationPayload Logic

Location: `packages/shared/src/utils/notificationsUtils.ts:127-173`

### Notification Modes

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

### Implementation

```typescript
export function parseNotificationPayload(
  mode: ENotificationPushMessageMode,
  payload: string | undefined,
  fallbackHandler: () => void,
) {
  switch (mode) {
    case ENotificationPushMessageMode.page:
      // Parse JSON payload and emit navigation event
      const payloadObj = JSON.parse(payload || '');
      appEventBus.emit(EAppEventBusNames.ShowNotificationPageNavigation, {
        payload: payloadObj,
      });
      break;

    case ENotificationPushMessageMode.dialog:
      // Parse JSON payload and emit dialog event
      const payloadObj = JSON.parse(payload || '');
      appEventBus.emit(EAppEventBusNames.ShowNotificationViewDialog, {
        payload: payloadObj,
      });
      break;

    case ENotificationPushMessageMode.openInBrowser:
      openUrlExternal(payload);
      break;

    case ENotificationPushMessageMode.openInApp:
      openUrlInApp(payload);
      break;

    case ENotificationPushMessageMode.openInDapp:
      appEventBus.emit(EAppEventBusNames.ShowNotificationInDappPage, payload);
      break;
  }
}
```

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

Run the following command to generate a complete list of all navigable routes with ready-to-use Mode 1 JSON payloads:

```bash
npx tsx development/scripts/extract-routes.ts
```

This will generate:
- `build/routes/ROUTES.md` - Markdown documentation with all routes and their parameters
- `build/routes/routes.json` - JSON format for programmatic access

Each route entry includes:
- Required and optional parameters
- Pre-filled `{local_*}` template variables for common params
- Complete Mode 1 JSON payload ready to copy

#### Mode 2: Dialog

```json
{
  "mode": 2,
  "payload": "{\"title\":\"Update Available\",\"description\":\"A new version is available.\",\"onConfirm\":{\"actionType\":\"openInBrowser\",\"payload\":\"https://onekey.so\"}}"
}
```

Dialog payload structure:
```typescript
interface INotificationViewDialogPayload {
  title?: string;
  description?: string;
  icon?: IKeyOfIcons;
  tone?: 'default' | 'destructive';
  confirmButtonProps?: { text: string };
  cancelButtonProps?: { text: string };
  onConfirm: {
    actionType: 'navigate' | 'openInApp' | 'openInBrowser';
    payload: string | NavigationPayload;
  };
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
          // Handle JPush launch notification
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

Location: `packages/kit/src/provider/Container/NotificationHandlerContainer/hooks.ts`

```typescript
export const useInitialNotification = () => {};  // No-op
```

Cold start handling is not needed for web/desktop/extension as:
- Web: Notifications don't persist across page reloads
- Desktop: App opens fresh, WebSocket reconnects
- Extension: Background script maintains state

---

## In-App Notification Toast

Location: `packages/kit/src/provider/Container/InAppNotification/index.tsx:410-461`

### When It Triggers

In-app notifications show when:
- WebSocket notification is received (`pushSource === 'websocket'`)
- Platform is NOT iOS native (iOS uses native notification center)

### Implementation

```typescript
useEffect(() => {
  const callback = ({
    notificationId,
    title,
    description,
    icon,
    remotePushMessageInfo,
  }) => {
    const topicType = remotePushMessageInfo?.extras?.topic;
    const isSystemTopic = topicType === ENotificationPushTopicTypes.system;

    const toast = Toast.notification({
      title,
      message: description,
      icon: isSystemTopic ? undefined : (icon as IKeyOfIcons),
      iconImageUri: isSystemTopic ? undefined : remotePushMessageInfo?.extras?.image,
      duration: 10 * 1000,
      imageUri: remotePushMessageInfo?.extras?.image,
      onPress: async () => {
        await whenAppUnlocked();
        await notificationsUtils.navigateToNotificationDetail({
          message: remotePushMessageInfo,
          isFromNotificationClick: true,
          notificationId: notificationId || '',
          mode: remotePushMessageInfo?.extras?.mode,
          payload: remotePushMessageInfo?.extras?.payload,
        });
        toast.close();
      },
    });
  };

  appEventBus.on(EAppEventBusNames.ShowInAppPushNotification, callback);
  return () => {
    appEventBus.off(EAppEventBusNames.ShowInAppPushNotification, callback);
  };
}, [navigation]);
```

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

### Customizing Toast Appearance

The `Toast.notification` component is defined in:
`packages/components/src/actions/Toast/index.tsx:272-375`

Key styling elements:
- Icon container: `bg="$bgStrong"`, `borderRadius="$full"`, 28x28px
- Title: `size="$headingSm"`, max 2 lines
- Message: `size="$bodyMd"`, `color="$textSubdued"`, max 3 lines
- Image: `borderRadius="$1"`, `size="$12"` (48px)

---

## Other parseNotificationPayload Usages

### 1. Hardware Device Get Started (DeviceGetStarted.tsx)

Location: `packages/kit/src/views/DeviceManagement/pages/DeviceDetailsModal/DeviceGetStarted.tsx:38-39`

```typescript
const handleOpen = (item: { mode: number; payload: string }) => {
  parseNotificationPayload(item.mode, item.payload, () => {});
};
```

Used for hardware wallet tutorial and FAQ links fetched from server.

### 2. Wallet Banner Clicks (useWalletBanner.ts)

Location: `packages/kit/src/hooks/useWalletBanner.ts:69-72`

```typescript
if (item.mode) {
  parseNotificationPayload(item.mode, item.payload, () => {});
  return;
}
```

Used for promotional banners in the wallet home screen.

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
