package so.onekey.app.wallet;

import android.app.Application;
import android.content.res.Configuration;
import android.database.CursorWindow;
import android.os.Build;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;

import cn.jiguang.plugins.push.JPushModule;
import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;
import so.onekey.app.wallet.splashscreen.SplashScreenPackage;

import java.io.IOException;
import java.lang.reflect.Field;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
    new ReactNativeHostWrapper(this, new DefaultReactNativeHost(this) {
      @Override
      public boolean getUseDeveloperSupport() {
        return BuildConfig.DEBUG;
      }

      @Override
      protected List<ReactPackage> getPackages() {
        @SuppressWarnings("UnnecessaryLocalVariable")

        List<ReactPackage> packages = new PackageList(this).getPackages();
        packages.add(new AutoUpdateModulePackage(mReactNativeHost));
        packages.add(new RootViewBackgroundPackage());
        // packages.add(new GeckoViewPackage());
        packages.add(new ExitPackage());
        packages.add(new WebViewCheckerPackage());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
          packages.add(new SplashScreenPackage());
        }
        return packages;
      }

      @Override
      protected String getJSMainModuleName() {
        return ".expo/.virtual-metro-entry";
      }

      @Override
      protected boolean isNewArchEnabled() {
        return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
      }

      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  });

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

    @Nullable
    @Override
    public ReactHost getReactHost() {
        return ReactNativeHostWrapper.createReactHost(this.getApplicationContext(), this.getReactNativeHost());
    }

    /**
   * Get rid of Meizu system's night mode "automatic color reversal" system feature.
   * <p>
   * 1. Indicates processing by the system (default)
   * 2. Disables color processing for the view in night mode
   * 3. Indicates that the view is directly reversed color processed in night mode
   * 4. Reduces the brightness of the view in night mode
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

    // SoLoader.init(this, /* native exopackage */ false);
    // if (!BuildConfig.REACT_NATIVE_UNSTABLE_USE_RUNTIME_SCHEDULER_ALWAYS) {
    //   ReactFeatureFlags.unstable_useRuntimeSchedulerAlways = false;
    // }
      try {
          SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE);
      } catch (IOException e) {
          throw new RuntimeException(e);
      }
      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      DefaultNewArchitectureEntryPoint.load();
    }
    // if (!BuildConfig.NO_FLIPPER) {
    //   ReactNativeFlipper.initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    // }
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    JPushModule.registerActivityLifecycle(this);
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }
}
