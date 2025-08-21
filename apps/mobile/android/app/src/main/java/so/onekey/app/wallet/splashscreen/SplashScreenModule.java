package so.onekey.app.wallet.splashscreen;

import android.os.Build;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.text.SimpleDateFormat;
import java.util.Date;

import so.onekey.app.wallet.splashscreen.singletons.SplashScreen;

public class SplashScreenModule extends ReactContextBaseJavaModule {
    
    @Override
    public String getName() {
        return "LegacySplashScreen";
    }

    private FileLoggerModule fileLogger;

    public SplashScreenModule(ReactApplicationContext context) {
        super(context);
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => LegacySplashScreenModule:" + name + ": " + msg);
    }

    @ReactMethod
    public void preventAutoHideAsync(com.facebook.react.bridge.Promise promise) {
        log("preventAutoHideAsync-OS_VERSION", Build.VERSION.SDK_INT + "");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            promise.resolve(true);
            return;
        }
        if (getCurrentActivity() != null) {
            log("preventAutoHide", "true");
            SplashScreen.INSTANCE.preventAutoHide(
                getCurrentActivity(),
                hasEffect -> promise.resolve(hasEffect),
                m -> promise.reject("PreventAutoHideException", m)
            );
        } else {
            log("preventAutoHide", "false");
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void hideAsync(com.facebook.react.bridge.Promise promise) {
        log("hideAsync-OS_VERSION", Build.VERSION.SDK_INT + "");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            promise.resolve(true);
            return;
        }
        if (getCurrentActivity() != null) {
            log("hide", "true");
            SplashScreen.INSTANCE.hide(
                getCurrentActivity(),
                hasEffect -> promise.resolve(hasEffect),
                m -> promise.reject("HideAsyncException", m)
            );
        } else {
            log("hide", "false");
            promise.resolve(false);
        }
    }
} 
