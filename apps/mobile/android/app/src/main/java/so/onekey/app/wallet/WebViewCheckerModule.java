package so.onekey.app.wallet;

import android.app.Activity;
import android.graphics.Color;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.text.SimpleDateFormat;
import java.util.Date;

public class WebViewCheckerModule extends ReactContextBaseJavaModule {
    private FileLoggerModule fileLogger;

    public WebViewCheckerModule(ReactApplicationContext context) {
        super(context);
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    @Override
    public String getName() {
        return "WebViewCheckerModule";
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => webviewChecker:" + name + ": " + msg);
    }

    @ReactMethod
    public void getCurrentWebViewPackageInfo(com.facebook.react.bridge.Promise promise) {
        log("getCurrentWebViewPackageInfo", "");
        try {
            android.content.pm.PackageManager pm = getReactApplicationContext().getPackageManager();
            android.content.pm.PackageInfo pInfo = pm.getPackageInfo("com.google.android.webview", 0);
            
            com.facebook.react.bridge.WritableMap result = com.facebook.react.bridge.Arguments.createMap();
            result.putString("packageName", pInfo.packageName);
            result.putString("versionName", pInfo.versionName);
            result.putInt("versionCode", pInfo.versionCode);
            log("getCurrentWebViewPackageInfo", pInfo.packageName + " " + pInfo.versionName + " " + pInfo.versionCode);
            promise.resolve(result);
        } catch (Exception e) {
            log("getCurrentWebViewPackageInfo", "Error: " + e.getMessage());
            promise.reject("GET_WEBVIEW_INFO_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isGooglePlayServicesAvailable(com.facebook.react.bridge.Promise promise) {
        log("isGooglePlayServicesAvailable", "");
        try {
            com.google.android.gms.common.GoogleApiAvailability googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance();
            int status = googleApiAvailability.isGooglePlayServicesAvailable(getReactApplicationContext());
            
            com.facebook.react.bridge.WritableMap result = com.facebook.react.bridge.Arguments.createMap();
            result.putInt("status", status);
            boolean isSuccess = status == com.google.android.gms.common.ConnectionResult.SUCCESS;
            result.putBoolean("isAvailable", isSuccess);
            log("isGooglePlayServicesAvailable", status + " " + isSuccess);
            promise.resolve(result);
        } catch (Exception e) {
            log("isGooglePlayServicesAvailable", "Error: " + e.getMessage());
            promise.reject("CHECK_PLAY_SERVICES_ERROR", e.getMessage());
        }
    }
}
