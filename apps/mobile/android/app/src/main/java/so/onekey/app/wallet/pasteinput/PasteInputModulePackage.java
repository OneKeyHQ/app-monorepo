package so.onekey.app.wallet.pasteinput;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class PasteInputModulePackage implements ReactPackage {

    public PasteInputModulePackage(ReactNativeHost mReactNativeHost) {
        super();
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {

        return Arrays.<ViewManager>asList(
                new TextInputManager(reactContext)
        );
    }

    @Override
    public List<NativeModule> createNativeModules(
            ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

}
