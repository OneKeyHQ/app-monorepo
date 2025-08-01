package so.onekey.app.wallet.splashscreen;

import android.os.Build;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import so.onekey.app.wallet.splashscreen.singletons.SplashScreen;

public class SplashScreenModule extends ReactContextBaseJavaModule {
    
    @Override
    public String getName() {
        return "LegacySplashScreen";
    }

    @ReactMethod
    public void preventAutoHideAsync(com.facebook.react.bridge.Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            promise.resolve(true);
            return;
        }
        if (getCurrentActivity() != null) {
            SplashScreen.INSTANCE.preventAutoHide(
                getCurrentActivity(),
                hasEffect -> promise.resolve(hasEffect),
                m -> promise.reject("PreventAutoHideException", m)
            );
        } else {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void hideAsync(com.facebook.react.bridge.Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            promise.resolve(true);
            return;
        }
        if (getCurrentActivity() != null) {
            SplashScreen.INSTANCE.hide(
                getCurrentActivity(),
                hasEffect -> promise.resolve(hasEffect),
                m -> promise.reject("HideAsyncException", m)
            );
        } else {
            promise.resolve(false);
        }
    }
} 
