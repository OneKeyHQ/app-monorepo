package so.onekey.app.wallet;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.Nullable;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.text.SimpleDateFormat;
import java.util.Date;

public class LaunchOptionModule extends ReactContextBaseJavaModule {
    private static final String TAG = "LaunchOptionModule";
    private static LaunchOptionModule instance;
    private FileLoggerModule fileLogger;
    
    private Bundle launchOptions;
    private String deviceToken;
    private Long startupTime;

    public LaunchOptionModule(ReactApplicationContext context) {
        super(context);
        instance = this;
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    public static LaunchOptionModule getInstance() {
        return instance;
    }

    @Override
    public String getName() {
        return "LaunchOptionModule";
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => LaunchOptionModule:" + name + ": " + msg);
        Log.d(TAG, name + ": " + msg);
    }

    public void saveStartupTime(Long startupTime) {
        this.startupTime = startupTime;
        log("saveStartupTime", "Startup time saved: " + startupTime);
    }

    public Long getStartupTime() {
        return startupTime;
    }

    public void saveLaunchOptions(Bundle launchOptions) {
        if (launchOptions != null) {
            this.launchOptions = launchOptions;
            log("saveLaunchOptions", "Launch options saved: " + launchOptions.toString());
        } else {
            log("saveLaunchOptions", "Launch options is null, skipping save");
        }
    }

    public Bundle getLaunchOptions() {
        synchronized (this) {
            return launchOptions;
        }
    }

    public void saveDeviceToken(String deviceToken) {
        if (deviceToken != null) {
            this.deviceToken = deviceToken;
            log("saveDeviceToken", "Device token saved");
        }
    }

    public String getDeviceToken() {
        return deviceToken;
    }

    @ReactMethod
    public void getLaunchOptions(Promise promise) {
        Bundle launchOptions = getLaunchOptions();
        
        log("getLaunchOptions", "Has launch options: " + (launchOptions != null ? "YES" : "NO"));
        
        if (launchOptions != null) {
            WritableMap result = Arguments.createMap();
            
            // Check if app was launched from notification
            Intent intent = getCurrentActivity() != null ? getCurrentActivity().getIntent() : null;
            if (intent != null) {
                Bundle extras = intent.getExtras();
                if (extras != null) {
                    // Check for local notification
                    if (extras.containsKey("notification")) {
                        WritableMap notificationInfo = Arguments.createMap();
                        notificationInfo.putString("userInfo", extras.getString("userInfo"));
                        result.putMap("localNotification", notificationInfo);
                        result.putString("launchType", "localNotification");
                    }
                    // Check for remote notification
                    else if (extras.containsKey("remoteNotification")) {
                        WritableMap notificationInfo = Arguments.createMap();
                        notificationInfo.putString("userInfo", extras.getString("userInfo"));
                        result.putMap("remoteNotification", notificationInfo);
                        result.putString("launchType", "remoteNotification");
                    }
                    // Check for deep link
                    else if (intent.getData() != null) {
                        result.putString("deepLink", intent.getData().toString());
                        result.putString("launchType", "deepLink");
                    }
                    else {
                        result.putString("launchType", "normal");
                    }
                } else {
                    result.putString("launchType", "normal");
                }
            } else {
                result.putString("launchType", "normal");
            }
            
            log("getLaunchOptions", "Result: " + result.toString());
            promise.resolve(result);
        } else {
            WritableMap result = Arguments.createMap();
            result.putString("launchType", "normal");
            promise.resolve(result);
        }
    }

    @ReactMethod
    public void getDeviceToken(Promise promise) {
        String deviceToken = getDeviceToken();
        promise.resolve(deviceToken);
    }

    @ReactMethod
    public void getStartupTime(Promise promise) {
        Long startupTime = getStartupTime();
        promise.resolve(startupTime != null ? startupTime : 0);
    }

    @ReactMethod
    public void clearLaunchOptions(Promise promise) {
        synchronized (this) {
            launchOptions = null;
            log("clearLaunchOptions", "Launch options cleared");
        }
        promise.resolve(true);
    }
}
