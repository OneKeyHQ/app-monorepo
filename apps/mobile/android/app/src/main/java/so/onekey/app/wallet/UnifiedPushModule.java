package so.onekey.app.wallet;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.SharedPreferences;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.List;

/**
 * UnifiedPush Native Module for React Native
 *
 * This module provides the bridge between React Native and the UnifiedPush
 * Android library. UnifiedPush is an open standard for push notifications
 * that respects user privacy.
 *
 * Implementation Notes:
 * ---------------------
 * This is a stub implementation. To fully implement UnifiedPush, you need to:
 *
 * 1. Add the UnifiedPush library to your build.gradle:
 *    implementation 'org.unifiedpush.android:connector:2.1.1'
 *
 * 2. Create a UnifiedPush receiver class that extends MessagingReceiver
 *
 * 3. Register the receiver in AndroidManifest.xml
 *
 * 4. Implement the actual push registration logic
 *
 * @see <a href="https://unifiedpush.org/developers/android/">UnifiedPush Android Docs</a>
 */
public class UnifiedPushModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "UnifiedPushModule";
    private static final String PREFS_NAME = "UnifiedPushPrefs";
    private static final String KEY_DISTRIBUTOR = "distributor";
    private static final String KEY_ENDPOINT = "endpoint";
    private static final String KEY_INSTANCE = "instance";

    private final ReactApplicationContext reactContext;
    private SharedPreferences preferences;

    public UnifiedPushModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.preferences = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Initialize the UnifiedPush connector.
     * This should be called when the app starts.
     */
    @ReactMethod
    public void initialize(Promise promise) {
        try {
            // TODO: Initialize UnifiedPush connector
            // Up.initialize(reactContext, "instance-name");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("INIT_ERROR", "Failed to initialize UnifiedPush", e);
        }
    }

    /**
     * Register for push notifications.
     * This will prompt the user to select a distributor if none is selected.
     *
     * @param instance A unique identifier for this registration (e.g., instanceId)
     */
    @ReactMethod
    public void registerForPush(String instance, Promise promise) {
        try {
            // TODO: Implement actual registration
            // Up.register(reactContext, instance);
            
            // Store instance
            preferences.edit().putString(KEY_INSTANCE, instance).apply();
            
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("REGISTER_ERROR", "Failed to register for push", e);
        }
    }

    /**
     * Unregister from push notifications.
     *
     * @param instance The instance identifier used during registration
     */
    @ReactMethod
    public void unregisterForPush(String instance, Promise promise) {
        try {
            // TODO: Implement actual unregistration
            // Up.unregister(reactContext, instance);
            
            // Clear stored data
            preferences.edit()
                .remove(KEY_ENDPOINT)
                .remove(KEY_INSTANCE)
                .apply();
            
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("UNREGISTER_ERROR", "Failed to unregister from push", e);
        }
    }

    /**
     * Get the currently selected distributor.
     */
    @ReactMethod
    public void getDistributor(Promise promise) {
        try {
            String distributor = preferences.getString(KEY_DISTRIBUTOR, null);
            promise.resolve(distributor);
        } catch (Exception e) {
            promise.reject("GET_DISTRIBUTOR_ERROR", "Failed to get distributor", e);
        }
    }

    /**
     * Get list of available UnifiedPush distributors on the device.
     * A distributor is an app that can receive push messages and deliver them.
     */
    @ReactMethod
    public void getDistributors(Promise promise) {
        try {
            WritableArray distributors = Arguments.createArray();
            
            // Query for apps that can handle UnifiedPush intents
            Intent intent = new Intent("org.unifiedpush.android.connector.MESSAGE");
            PackageManager pm = reactContext.getPackageManager();
            List<ResolveInfo> resolveInfos = pm.queryBroadcastReceivers(intent, 0);
            
            for (ResolveInfo info : resolveInfos) {
                WritableMap distributor = Arguments.createMap();
                distributor.putString("packageName", info.activityInfo.packageName);
                distributor.putString("name", info.loadLabel(pm).toString());
                distributors.pushMap(distributor);
            }
            
            promise.resolve(distributors);
        } catch (Exception e) {
            promise.reject("GET_DISTRIBUTORS_ERROR", "Failed to get distributors", e);
        }
    }

    /**
     * Select a UnifiedPush distributor.
     * This should be called before registering for push.
     *
     * @param packageName The package name of the distributor app
     */
    @ReactMethod
    public void selectDistributor(String packageName, Promise promise) {
        try {
            // TODO: Implement actual distributor selection
            // Up.saveDistributor(reactContext, packageName);
            
            preferences.edit().putString(KEY_DISTRIBUTOR, packageName).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SELECT_DISTRIBUTOR_ERROR", "Failed to select distributor", e);
        }
    }

    /**
     * Get the current push endpoint URL.
     * This is the URL that the server should use to send push messages.
     *
     * @param instance The instance identifier
     */
    @ReactMethod
    public void getEndpoint(String instance, Promise promise) {
        try {
            String endpoint = preferences.getString(KEY_ENDPOINT, null);
            promise.resolve(endpoint);
        } catch (Exception e) {
            promise.reject("GET_ENDPOINT_ERROR", "Failed to get endpoint", e);
        }
    }

    /**
     * Check if currently registered for push notifications.
     *
     * @param instance The instance identifier
     */
    @ReactMethod
    public void isRegistered(String instance, Promise promise) {
        try {
            String storedInstance = preferences.getString(KEY_INSTANCE, null);
            String endpoint = preferences.getString(KEY_ENDPOINT, null);
            boolean registered = instance.equals(storedInstance) && endpoint != null;
            promise.resolve(registered);
        } catch (Exception e) {
            promise.reject("IS_REGISTERED_ERROR", "Failed to check registration", e);
        }
    }

    /**
     * Send an event to React Native.
     * Called from the UnifiedPush receiver when messages arrive.
     */
    public void sendEvent(String eventType, WritableMap params) {
        if (reactContext.hasActiveReactInstance()) {
            params.putString("type", eventType);
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("UnifiedPushEvent", params);
        }
    }

    /**
     * Store the endpoint when received from the distributor.
     * Called from the UnifiedPush receiver.
     */
    public void onNewEndpoint(String endpoint, String instance) {
        preferences.edit().putString(KEY_ENDPOINT, endpoint).apply();
        
        WritableMap params = Arguments.createMap();
        params.putString("endpoint", endpoint);
        params.putString("instance", instance);
        sendEvent("newEndpoint", params);
    }

    /**
     * Handle incoming push message.
     * Called from the UnifiedPush receiver.
     */
    public void onMessage(String message, String instance) {
        WritableMap params = Arguments.createMap();
        params.putString("message", message);
        params.putString("instance", instance);
        sendEvent("message", params);
    }

    /**
     * Handle unregistration event.
     * Called from the UnifiedPush receiver.
     */
    public void onUnregistered(String instance) {
        preferences.edit()
            .remove(KEY_ENDPOINT)
            .remove(KEY_INSTANCE)
            .apply();
        
        WritableMap params = Arguments.createMap();
        params.putString("instance", instance);
        sendEvent("unregistered", params);
    }

    /**
     * Handle registration failure.
     * Called from the UnifiedPush receiver.
     */
    public void onRegistrationFailed(String instance, String error) {
        WritableMap params = Arguments.createMap();
        params.putString("instance", instance);
        params.putString("error", error);
        sendEvent("registrationFailed", params);
    }
}
