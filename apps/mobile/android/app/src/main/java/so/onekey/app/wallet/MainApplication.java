package so.onekey.app.wallet;

import android.app.Application;
import android.content.res.Configuration;
import androidx.annotation.NonNull;
import androidx.annotation.Keep;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.react.flipper.ReactNativeFlipper;
import com.facebook.soloader.SoLoader;

import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;

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
        // Packages that cannot be autolinked yet can be added manually here, for example:
        // packages.add(new MyReactNativePackage());
          packages.add(new BundleModulePackage(mReactNativeHost));
          packages.add(new DownloadModulePackage(mReactNativeHost));
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
    SoLoader.init(this, /* native exopackage */ false);
    if (!BuildConfig.REACT_NATIVE_UNSTABLE_USE_RUNTIME_SCHEDULER_ALWAYS) {
      ReactFeatureFlags.unstable_useRuntimeSchedulerAlways = false;
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      DefaultNewArchitectureEntryPoint.load();
    }
    if (!BuildConfig.NO_FLIPPER) {
      ReactNativeFlipper.initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }
}
