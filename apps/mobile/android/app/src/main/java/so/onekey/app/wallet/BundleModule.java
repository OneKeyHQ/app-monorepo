package so.onekey.app.wallet;

import androidx.annotation.NonNull;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BundleModule extends ReactContextBaseJavaModule {

    ReactNativeHost reactNativeHost;
    ReactContext reactContext;

    BundleModule(ReactApplicationContext context, ReactNativeHost reactNativeHost) {
        super(context);
        this.reactNativeHost = reactNativeHost;
        this.reactContext = context;
    }

    @ReactMethod
    public void executeSourceCode(String hashId) {
        this.reactNativeHost.getReactInstanceManager()
                .getCurrentReactContext()
                .getCatalystInstance()
                .loadScriptFromAssets(
                        this.reactContext.getAssets(),
                        "assets://custom/" + hashId + ".bundle",
                        false
                );
    }

    @NonNull
    @Override
    public String getName() {
        return "Bundle";
    }
}
