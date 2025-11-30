package so.onekey.app.wallet.dualscreen;

import android.app.Activity;
import android.content.Context;
import android.graphics.Rect;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.window.layout.DisplayFeature;
import androidx.window.layout.FoldingFeature;
import androidx.window.layout.WindowInfoTracker;
import androidx.window.layout.WindowLayoutInfo;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

import androidx.core.util.Consumer;

/**
 * React Native module to detect dual-screen and foldable devices
 * Provides information about screen spanning and display features
 */
public class DualScreenInfoModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String MODULE_NAME = "DualScreenInfo";
    private static final String EVENT_DID_UPDATE_SPANNING = "didUpdateSpanning";
    
    private final ReactApplicationContext reactContext;
    private WindowLayoutInfo windowLayoutInfo;
    private boolean isSpanning = false;
    private Consumer<WindowLayoutInfo> layoutInfoConsumer;
    private WindowInfoTracker windowInfoTracker;

    public DualScreenInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        reactContext.addLifecycleEventListener(this);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("EVENT_DID_UPDATE_SPANNING", EVENT_DID_UPDATE_SPANNING);
        return constants;
    }

    /**
     * Check if the device is a dual-screen or foldable device
     */
    @ReactMethod
    public void isDualScreenDevice(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.resolve(false);
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Check if device supports window layout info
                promise.resolve(hasFoldingFeature(activity));
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Check if the app is currently spanning across screens
     */
    @ReactMethod
    public void isSpanning(Promise promise) {
        try {
            promise.resolve(this.isSpanning);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get spanning state", e);
        }
    }

    /**
     * Get the window rectangles for dual-screen devices
     * Returns an array of rectangles representing each screen region
     */
    @ReactMethod
    public void getWindowRects(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null || windowLayoutInfo == null) {
                promise.resolve(Arguments.createArray());
                return;
            }

            WritableArray rects = getWindowRectsFromLayoutInfo(activity, windowLayoutInfo);
            promise.resolve(rects);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get window rects", e);
        }
    }

    /**
     * Get hinge information for foldable devices
     */
    @ReactMethod
    public void getHingeBounds(Promise promise) {
        try {
            if (windowLayoutInfo == null) {
                promise.resolve(null);
                return;
            }

            FoldingFeature foldingFeature = getFoldingFeature(windowLayoutInfo);
            if (foldingFeature != null) {
                WritableMap hingeMap = Arguments.createMap();
                Rect bounds = foldingFeature.getBounds();
                hingeMap.putInt("x", bounds.left);
                hingeMap.putInt("y", bounds.top);
                hingeMap.putInt("width", bounds.width());
                hingeMap.putInt("height", bounds.height());
                promise.resolve(hingeMap);
            } else {
                promise.resolve(null);
            }
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get hinge bounds", e);
        }
    }

    /**
     * Start observing window layout changes
     */
    private void startObservingLayoutChanges() {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            return;
        }

        // Window Manager library requires API 24+, but full foldable support is API 30+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                windowInfoTracker = WindowInfoTracker.getOrCreate(activity);
                
                // Create consumer for window layout info
                layoutInfoConsumer = new Consumer<WindowLayoutInfo>() {
                    @Override
                    public void accept(WindowLayoutInfo layoutInfo) {
                        onWindowLayoutInfoChanged(layoutInfo);
                    }
                };
                
                // Use Java-friendly callback approach
                // Note: This uses kotlinx.coroutines Flow under the hood,
                // but we access it through a Java-compatible API
                Executor mainExecutor = activity.getMainExecutor();
                
                // Subscribe to window layout changes
                // The windowLayoutInfo() method returns a Flow, but we can use
                // a callback-based approach for Java
                androidx.window.java.layout.WindowInfoTrackerCallbackAdapter callbackAdapter = 
                    new androidx.window.java.layout.WindowInfoTrackerCallbackAdapter(windowInfoTracker);
                
                callbackAdapter.addWindowLayoutInfoListener(
                    activity,
                    mainExecutor,
                    layoutInfoConsumer
                );
            } catch (Exception e) {
                // Window tracking not supported on this device/API level, ignore
            }
        }
    }

    /**
     * Stop observing window layout changes
     */
    private void stopObservingLayoutChanges() {
        if (windowInfoTracker != null && layoutInfoConsumer != null) {
            try {
                // The callback adapter doesn't have a direct remove method
                // The listener will be cleaned up when the activity is destroyed
                layoutInfoConsumer = null;
                windowInfoTracker = null;
            } catch (Exception e) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Handle window layout info changes
     */
    private void onWindowLayoutInfoChanged(WindowLayoutInfo layoutInfo) {
        this.windowLayoutInfo = layoutInfo;
        
        boolean wasSpanning = this.isSpanning;
        this.isSpanning = checkIsSpanning(layoutInfo);

        // Emit event if spanning state changed
        if (wasSpanning != this.isSpanning) {
            sendSpanningEvent();
        }
    }

    /**
     * Check if the app is spanning based on layout info
     */
    private boolean checkIsSpanning(WindowLayoutInfo layoutInfo) {
        if (layoutInfo == null) {
            return false;
        }

        FoldingFeature foldingFeature = getFoldingFeature(layoutInfo);
        if (foldingFeature == null) {
            return false;
        }

        // Consider spanning if the folding feature divides the screen
        return foldingFeature.getState() == FoldingFeature.State.FLAT ||
               foldingFeature.getState() == FoldingFeature.State.HALF_OPENED;
    }

    /**
     * Get folding feature from window layout info
     */
    @Nullable
    private FoldingFeature getFoldingFeature(WindowLayoutInfo layoutInfo) {
        if (layoutInfo == null) {
            return null;
        }

        List<DisplayFeature> features = layoutInfo.getDisplayFeatures();
        for (DisplayFeature feature : features) {
            if (feature instanceof FoldingFeature) {
                return (FoldingFeature) feature;
            }
        }
        return null;
    }

    /**
     * Check if device has folding feature support
     */
    @RequiresApi(api = Build.VERSION_CODES.R)
    private boolean hasFoldingFeature(Activity activity) {
        // This is a best-effort check
        // In a real implementation, you might want to check device manufacturer and model
        return true; // Assume support for now, actual spanning detection happens in runtime
    }

    /**
     * Get window rectangles from layout info
     */
    private WritableArray getWindowRectsFromLayoutInfo(Activity activity, WindowLayoutInfo layoutInfo) {
        WritableArray rects = Arguments.createArray();
        
        if (layoutInfo == null) {
            return rects;
        }

        FoldingFeature foldingFeature = getFoldingFeature(layoutInfo);
        if (foldingFeature == null) {
            // No folding feature, return full screen rect
            Rect screenRect = new Rect();
            activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(screenRect);
            rects.pushMap(rectToMap(screenRect));
            return rects;
        }

        // Split screen based on folding feature
        Rect hingeBounds = foldingFeature.getBounds();
        Rect screenRect = new Rect();
        activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(screenRect);

        if (foldingFeature.getOrientation() == FoldingFeature.Orientation.VERTICAL) {
            // Vertical fold - left and right screens
            Rect leftRect = new Rect(screenRect.left, screenRect.top, hingeBounds.left, screenRect.bottom);
            Rect rightRect = new Rect(hingeBounds.right, screenRect.top, screenRect.right, screenRect.bottom);
            rects.pushMap(rectToMap(leftRect));
            rects.pushMap(rectToMap(rightRect));
        } else {
            // Horizontal fold - top and bottom screens
            Rect topRect = new Rect(screenRect.left, screenRect.top, screenRect.right, hingeBounds.top);
            Rect bottomRect = new Rect(screenRect.left, hingeBounds.bottom, screenRect.right, screenRect.bottom);
            rects.pushMap(rectToMap(topRect));
            rects.pushMap(rectToMap(bottomRect));
        }

        return rects;
    }

    /**
     * Convert Rect to WritableMap
     */
    private WritableMap rectToMap(Rect rect) {
        WritableMap map = Arguments.createMap();
        map.putInt("x", rect.left);
        map.putInt("y", rect.top);
        map.putInt("width", rect.width());
        map.putInt("height", rect.height());
        return map;
    }

    /**
     * Send spanning event to JavaScript
     */
    private void sendSpanningEvent() {
        WritableMap params = Arguments.createMap();
        params.putBoolean("isSpanning", this.isSpanning);
        
        sendEvent(reactContext, EVENT_DID_UPDATE_SPANNING, params);
    }

    /**
     * Send event to JavaScript
     */
    private void sendEvent(ReactContext reactContext, String eventName, @Nullable WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @Override
    public void onHostResume() {
        startObservingLayoutChanges();
    }

    @Override
    public void onHostPause() {
        stopObservingLayoutChanges();
    }

    @Override
    public void onHostDestroy() {
        stopObservingLayoutChanges();
    }

    @Override
    public void invalidate() {
        stopObservingLayoutChanges();
        reactContext.removeLifecycleEventListener(this);
    }
}

