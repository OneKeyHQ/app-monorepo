package so.onekey.app.wallet;

import android.os.Bundle;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
        import com.facebook.react.bridge.NativeModule;
        import com.facebook.react.bridge.ReactApplicationContext;
        import com.facebook.react.uimanager.ViewManager;

        import java.util.ArrayList;
        import java.util.Collections;
        import java.util.List;

public class BundleModulePackage implements ReactPackage {
    ReactNativeHost mReactNativeHost;

    BundleModulePackage(ReactNativeHost mReactNativeHost) {
        super();
        this.mReactNativeHost = mReactNativeHost;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(
            ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();

        modules.add(new BundleModule(reactContext, this.mReactNativeHost));

        return modules;
    }

}