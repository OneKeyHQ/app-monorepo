package so.onekey.app.wallet;

import android.app.Application;
import android.content.Context;
import android.content.res.Configuration;
import android.util.Log;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import android.database.CursorWindow;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.soloader.SoLoader;
import com.facebook.react.bridge.JavaScriptExecutorFactory;
import com.facebook.react.modules.systeminfo.AndroidInfoHelpers;

import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;
//import expo.modules.devlauncher.DevLauncherController;
import so.onekey.app.wallet.newarchitecture.MainApplicationReactNativeHost;
import so.onekey.app.wallet.utils.Utils;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import android.webkit.WebView;

import io.csie.kudo.reactnative.v8.executor.V8ExecutorFactory;
import cn.jiguang.plugins.push.JPushModule;

public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost mNewArchitectureNativeHost =
          new ReactNativeHostWrapper(this, new MainApplicationReactNativeHost(this));
  private final ReactNativeHost mReactNativeHost = new ReactNativeHostWrapper(
    this,
    new ReactNativeHost(this) {
    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
      // return DevLauncherController.getInstance().getUseDeveloperSupport();
    }

    @Override
    protected List<ReactPackage> getPackages() {
      @SuppressWarnings("UnnecessaryLocalVariable")
      List<ReactPackage> packages = new PackageList(this).getPackages();
      // Packages that cannot be autolinked yet can be added manually here, for example:
      // packages.add(new MyReactNativePackage());
      packages.add(new MainReactNativePackage());
      return packages;
    }

    @Override
    protected String getJSMainModuleName() {
      return "__generated__/AppEntry.js";
    }

    @Override
    protected JavaScriptExecutorFactory getJavaScriptExecutorFactory() {
      return new V8ExecutorFactory(
          getApplicationContext(),
          getPackageName(),
          AndroidInfoHelpers.getFriendlyDeviceName(),
          getUseDeveloperSupport());
    }

  });

  @Override
  public ReactNativeHost getReactNativeHost() {
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      return mNewArchitectureNativeHost;
    } else {
      return mReactNativeHost;
    }
  }

  /**
   * 摆脱魅族系统的夜间模式「自动反色」系统
   *
   * 1. 表示由系统处理（默认）
   * 2. 表示禁止针对该view在夜间模式下进行颜色处理
   * 3. 表示夜间模式下直接针对该 view 进行反色处理
   * 4. 表示夜间模式下直接针对该 view 进行降低亮度
   */
  @Keep
  public int mzNightModeUseOf() {
    return 2;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    try {
      Field field = CursorWindow.class.getDeclaredField("sCursorWindowSize");
      field.setAccessible(true);
      field.set(null, 20 * 1024 * 1024);
    } catch (Exception e) {
      e.printStackTrace();
    }

    // If you opted-in for the New Architecture, we enable the TurboModule system
    ReactFeatureFlags.useTurboModules = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
    Utils.init(this);
    SoLoader.init(this, /* native exopackage */ false);

//    if(BuildConfig.ENABLE_DEV_CLI){
//      DevLauncherController.initialize(this, getReactNativeHost());
//    }
    // if (BuildConfig.DEBUG) {
    //   WebView.setWebContentsDebuggingEnabled(true);
    // }

    WebView.setWebContentsDebuggingEnabled(true);


    initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    JPushModule.registerActivityLifecycle(this);
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context, ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        Class<?> aClass = Class.forName("so.onekey.app.wallet.ReactNativeFlipper");
        aClass
            .getMethod("initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }

}
