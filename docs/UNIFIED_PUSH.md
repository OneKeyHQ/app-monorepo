# UnifiedPush Integration

## Overview

UnifiedPush is an open-source, privacy-friendly push notification specification that allows users to choose their own push notification provider (distributor). This provides significant privacy benefits compared to proprietary solutions like Google FCM or JPush.

## Benefits

- **No Google Play Services Required**: Works on degoogled Android devices (GrapheneOS, LineageOS, etc.)
- **User-Controlled**: Users choose their own push provider
- **Self-Hostable**: Users can run their own push server
- **No Third-Party Data Collection**: Push messages don't go through Google or other third parties
- **End-to-End Encryption**: Possible with compatible distributors

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   OneKey    │    │ UnifiedPush │    │   OneKey    │
│   Server    │───▶│ Distributor │───▶│    App      │
└─────────────┘    │   (ntfy,    │    └─────────────┘
                   │  NextPush)  │
                   └─────────────┘
```

1. **App** registers with a UnifiedPush distributor installed on the device
2. **Distributor** provides an endpoint URL to the app
3. **App** sends the endpoint URL to the OneKey server
4. **Server** sends push messages to the endpoint URL
5. **Distributor** delivers the message to the app

## Supported Distributors

Users can install any UnifiedPush-compatible distributor:

| Distributor | Description | Privacy Level |
|-------------|-------------|---------------|
| [ntfy](https://ntfy.sh) | Simple HTTP-based pub-sub. Self-hostable. | High |
| [NextPush](https://github.com/UP-NextPush/android) | Push via Nextcloud server | High |
| [UP-FCM](https://github.com/nicoretti/up-fcm-distributor) | Uses Google FCM as transport | Low |
| [Molly UnifiedPush](https://github.com/nicoretti/up-fcm-distributor) | From the Molly Signal fork | High |

## Implementation

### Files Added/Modified

#### Core Provider
- `packages/kit-bg/src/services/ServiceNotification/PushProvider/PushProviderUnifiedPush.ts`
  - Main UnifiedPush provider implementation
  - Handles registration, message receiving, and event emission

#### Types
- `packages/shared/types/notification.ts`
  - Added `unifiedpush_connected` event
  - Added `unifiedPushEndpoint` to push client
  - Added `unifiedpush` as a push source
  - Added UnifiedPush settings fields

#### Service
- `packages/kit-bg/src/services/ServiceNotification/ServiceNotification.ts`
  - Added UnifiedPush connection handler
  - Updated notification display logic for UnifiedPush

#### Settings
- `packages/kit-bg/src/states/jotai/atoms/devSettings.ts`
  - Added `disabledUnifiedPush` and `preferUnifiedPush` settings

#### UI
- `packages/kit/src/views/Setting/pages/Notifications/UnifiedPushSettings.tsx`
  - User-facing settings component
- `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/NotificationDevSettings.tsx`
  - Developer settings toggles

#### Utilities
- `packages/shared/src/utils/unifiedPushUtils.ts`
  - Helper functions and known distributor list

#### Android Native Module
- `apps/mobile/android/app/src/main/java/so/onekey/app/wallet/UnifiedPushModule.java`
  - React Native bridge module (stub implementation)
- `apps/mobile/android/app/src/main/java/so/onekey/app/wallet/UnifiedPushPackage.java`
  - Package registration

## Completing the Android Implementation

The provided Android module is a stub. To fully implement UnifiedPush:

### 1. Add Dependencies

In `apps/mobile/android/app/build.gradle`:

```gradle
dependencies {
    implementation 'org.unifiedpush.android:connector:2.1.1'
}
```

### 2. Create a Message Receiver

Create `UnifiedPushReceiver.java`:

```java
package so.onekey.app.wallet;

import android.content.Context;
import org.unifiedpush.android.connector.MessagingReceiver;

public class UnifiedPushReceiver extends MessagingReceiver {
    
    public UnifiedPushReceiver() {
        super();
    }
    
    @Override
    public void onNewEndpoint(Context context, String endpoint, String instance) {
        // Get the module and notify React Native
        // UnifiedPushModule.getInstance().onNewEndpoint(endpoint, instance);
    }
    
    @Override
    public void onMessage(Context context, byte[] message, String instance) {
        String messageStr = new String(message);
        // UnifiedPushModule.getInstance().onMessage(messageStr, instance);
    }
    
    @Override
    public void onUnregistered(Context context, String instance) {
        // UnifiedPushModule.getInstance().onUnregistered(instance);
    }
    
    @Override
    public void onRegistrationFailed(Context context, String instance) {
        // UnifiedPushModule.getInstance().onRegistrationFailed(instance, "Registration failed");
    }
}
```

### 3. Register the Receiver

In `AndroidManifest.xml`:

```xml
<receiver
    android:name=".UnifiedPushReceiver"
    android:exported="true"
    android:enabled="true">
    <intent-filter>
        <action android:name="org.unifiedpush.android.connector.MESSAGE"/>
        <action android:name="org.unifiedpush.android.connector.UNREGISTERED"/>
        <action android:name="org.unifiedpush.android.connector.NEW_ENDPOINT"/>
        <action android:name="org.unifiedpush.android.connector.REGISTRATION_FAILED"/>
    </intent-filter>
</receiver>
```

### 4. Update the Module

Update `UnifiedPushModule.java` to use the UnifiedPush library:

```java
import org.unifiedpush.android.connector.UnifiedPush;

@ReactMethod
public void registerForPush(String instance, Promise promise) {
    try {
        UnifiedPush.registerApp(reactContext, instance, new ArrayList<>(), "OneKey");
        preferences.edit().putString(KEY_INSTANCE, instance).apply();
        promise.resolve(true);
    } catch (Exception e) {
        promise.reject("REGISTER_ERROR", "Failed to register for push", e);
    }
}
```

## Server-Side Integration

The server needs to:

1. Accept the UnifiedPush endpoint URL during client registration
2. Send push messages via HTTP POST to the endpoint URL
3. Message format:

```json
{
    "title": "Transaction Received",
    "message": "You received 0.5 ETH",
    "data": {
        "msgId": "unique-message-id",
        "topic": "accountActivity",
        "params": {
            "networkId": "evm--1",
            "transactionHash": "0x..."
        }
    }
}
```

Example using curl:

```bash
curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"title":"Test","message":"Hello from OneKey"}' \
    https://ntfy.sh/your-endpoint-topic
```

## iOS Support

UnifiedPush is primarily an Android specification. For iOS:

- Continue using APNs (Apple Push Notification Service) as the primary push method
- The app already supports APNs through expo-notifications
- Consider adding support for alternative iOS push solutions in the future

## Testing

1. Install a UnifiedPush distributor (e.g., ntfy from F-Droid)
2. Open OneKey app settings
3. Navigate to Notifications > UnifiedPush
4. Select the distributor
5. Register for push notifications
6. Verify the endpoint is received
7. Send a test push message to the endpoint

## Privacy Comparison

| Provider | Google Services | Data to Third Party | Self-Hostable |
|----------|-----------------|---------------------|---------------|
| UnifiedPush | ❌ | ❌ (with self-hosted) | ✅ |
| JPush | ❌ | ✅ | ❌ |
| FCM | ✅ | ✅ | ❌ |
| WebSocket | ❌ | ❌ | ✅ |

## Resources

- [UnifiedPush Website](https://unifiedpush.org/)
- [UnifiedPush Android Documentation](https://unifiedpush.org/developers/android/)
- [UnifiedPush Distributors List](https://unifiedpush.org/users/distributors/)
- [ntfy](https://ntfy.sh/) - Popular self-hosted option
