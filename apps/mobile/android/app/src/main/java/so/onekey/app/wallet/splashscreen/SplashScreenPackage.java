package so.onekey.app.wallet.splashscreen;

import android.content.Context;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import expo.modules.core.interfaces.ReactActivityLifecycleListener;
import expo.modules.core.interfaces.SingletonModule;
import so.onekey.app.wallet.splashscreen.singletons.SplashScreen;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SplashScreenPackage implements ReactPackage {
    
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SplashScreenModule(reactContext));
        return modules;
    }

    public List<SingletonModule> createSingletonModules(Context context) {
        return Collections.singletonList(SplashScreen.INSTANCE);
    }

    public List<ReactActivityLifecycleListener> createReactActivityLifecycleListeners(Context activityContext) {
        return Collections.singletonList(new SplashScreenReactActivityLifecycleListener(activityContext));
    }
} 
