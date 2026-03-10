package so.onekey.app.wallet;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.reactnativecommunity.webview.RNCWebChromeClient;

import java.util.HashSet;
import java.util.Set;

public class MediaPermissionModule extends ReactContextBaseJavaModule {

    public MediaPermissionModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "MediaPermissionModule";
    }

    @ReactMethod
    public void setMediaPermissionWhitelist(ReadableArray origins) {
        Set<String> set = new HashSet<>();
        for (int i = 0; i < origins.size(); i++) {
            set.add(origins.getString(i));
        }
        RNCWebChromeClient.setMediaPermissionWhitelist(set);
    }
}
