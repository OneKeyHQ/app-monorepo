package so.onekey.app.wallet;

import android.app.Application;
import android.net.Uri;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.CursorWindow;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.backgroundthread.BackgroundThreadManager;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactInstanceEventListener;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.modules.systeminfo.AndroidInfoHelpers;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;

import cn.jiguang.plugins.push.JPushModule;
import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import com.margelo.nitro.reactnativedeviceutils.ReactNativeDeviceUtils;
import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Field;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  public static boolean shouldShowRecovery = false;

  private final ReactNativeHost mReactNativeHost =
    new ReactNativeHostWrapper(this, new CustomReactNativeHost(this) {
      @Override
      public boolean getUseDeveloperSupport() {
        return BuildConfig.DEBUG;
      }

      @Override
      protected List<ReactPackage> getPackages() {
        @SuppressWarnings("UnnecessaryLocalVariable")

        List<ReactPackage> packages = new PackageList(this).getPackages();
        // All native modules are now Nitro modules (auto-linked)
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
      protected boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  });
  @Nullable
  private ReactHost mReactHost;

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

    @Nullable
    @Override
    public ReactHost getReactHost() {
        if (mReactHost == null) {
          mReactHost =
            ReactNativeHostWrapper.createReactHost(
              this.getApplicationContext(),
              this.getReactNativeHost()
            );
        }
        return mReactHost;
    }

    @Nullable
    private String getCurrentBackgroundBundlePath() {
      return BundleUpdateStoreAndroid.INSTANCE.getCurrentBundleBackgroundJSBundle(this);
    }

    private boolean isBackgroundBundlePathExists(@NonNull String bundlePath) {
      String filePath = bundlePath;
      if (bundlePath.startsWith("file://")) {
        String parsedPath = Uri.parse(bundlePath).getPath();
        if (parsedPath != null && !parsedPath.isEmpty()) {
          filePath = parsedPath;
        }
      }
      return new File(filePath).exists();
    }

    @NonNull
    private String getBackgroundRunnerEntryUrl() {
      if (BuildConfig.DEBUG) {
        String host = AndroidInfoHelpers.getServerHost(this, 8082);
        String entryUrl =
          "http://" + host
            + "/background.bundle?platform=android&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true";
        OneKeyLog.info("BackgroundThread", "getBackgroundRunnerEntryUrl(DEBUG): " + entryUrl);
        return entryUrl;
      }

      String bundlePath = getCurrentBackgroundBundlePath();
      if (bundlePath != null && !bundlePath.isEmpty()) {
        boolean exists = isBackgroundBundlePathExists(bundlePath);
        OneKeyLog.info(
          "BundleUpdate",
          "getBackgroundRunnerEntryUrl(RELEASE): otaPath=" + bundlePath + ", exists=" + exists
        );
        if (exists) {
          return bundlePath;
        }
      }

      OneKeyLog.info(
        "BundleUpdate",
        "getBackgroundRunnerEntryUrl(RELEASE): fallback background.bundle"
      );
      return "background.bundle";
    }

    private void setupBackgroundThreadBootstrap() {
      ReactHost reactHost = getReactHost();
      if (reactHost == null) {
        OneKeyLog.warn("BackgroundThread", "setupBackgroundThreadBootstrap: ReactHost is null");
        return;
      }

      reactHost.addReactInstanceEventListener(new ReactInstanceEventListener() {
        @Override
        public void onReactContextInitialized(ReactContext context) {
          if (!(context instanceof ReactApplicationContext)) {
            OneKeyLog.warn(
              "BackgroundThread",
              "onReactContextInitialized: ReactContext is not ReactApplicationContext"
            );
            return;
          }

          ReactApplicationContext reactApplicationContext =
            (ReactApplicationContext) context;
          BackgroundThreadManager manager = BackgroundThreadManager.getInstance();
          manager.setReactPackages(new PackageList(MainApplication.this).getPackages());
          manager.installSharedBridgeInMainRuntime(reactApplicationContext);

          String entryUrl = getBackgroundRunnerEntryUrl();
          OneKeyLog.info(
            "BackgroundThread",
            "onReactContextInitialized: start background runner with entryURL=" + entryUrl
          );
          manager.startBackgroundRunnerWithEntryURL(reactApplicationContext, entryUrl);
        }
      });
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
    // Recovery check
    SharedPreferences prefs = getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE);

    // Version-aware counter reset
    String currentVersion = BuildConfig.VERSION_NAME;
    String storedVersion = prefs.getString(BootRecoveryKeys.BOOT_FAIL_APP_VERSION, "");
    if (!storedVersion.isEmpty() && !storedVersion.equals(currentVersion)) {
        prefs.edit().putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0).commit();
    }
    prefs.edit().putString(BootRecoveryKeys.BOOT_FAIL_APP_VERSION, currentVersion).commit();

    // Increment boot fail count; counter is reset in MainActivity.onStop()
    // on graceful exit, so only consecutive crashes accumulate
    int oldCount = prefs.getInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0);
    int newCount = oldCount + 1;
    prefs.edit().putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, newCount).commit();

    // Harness tests create this marker file via globalSetup so the recovery
    // page never blocks React Native from starting during test runs.
    boolean isHarnessMode = new java.io.File(getFilesDir(), "harness_mode").exists();
    shouldShowRecovery = !isHarnessMode && newCount >= 3;

    super.onCreate();

    // SoLoader and new architecture entry point must be initialized before
    // the recovery early-return because MainActivity extends ReactActivity,
    // and super.onCreate(null) triggers SoLoader.loadLibrary() and Fabric/
    // TurboModules initialization. Without these, recovery mode itself crashes.
    try {
        SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE);
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load();
    }

    OneKeyLog.info("BootRecovery", "boot_fail_count: " + oldCount + " -> " + newCount + ", shouldShowRecovery: " + shouldShowRecovery);

    if (shouldShowRecovery) {
        // Skip heavy initialization (React Native, Expo, JPush).
        // RecoveryActivity is a plain Android Activity and doesn't need them.
        // This prevents crashes in RN initialization from blocking recovery.
        return;
    }

    long startupTime = System.currentTimeMillis();
    ReactNativeDeviceUtils.saveStartupTimeStatic(startupTime);
    OneKeyLog.info("App", "OneKey started");
    String builtinBundleVersion = "";
    try {
      android.content.pm.ApplicationInfo ai = getPackageManager().getApplicationInfo(getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
      if (ai.metaData != null) {
        builtinBundleVersion = ai.metaData.getString("BUNDLE_VERSION", "");
      }
    } catch (Exception ignored) {}
    OneKeyLog.info("App", "nativeAppVersion: " + BuildConfig.VERSION_NAME + ", buildNumber: " + BuildConfig.VERSION_CODE + ", builtinBundleVersion: " + builtinBundleVersion);

    try {
      Field field = CursorWindow.class.getDeclaredField("sCursorWindowSize");
      field.setAccessible(true);
      field.set(null, 20 * 1024 * 1024);
    } catch (Exception e) {
      e.printStackTrace();
    }

    // if (!BuildConfig.NO_FLIPPER) {
    //   ReactNativeFlipper.initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    // }
    setupBackgroundThreadBootstrap();
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    JPushModule.registerActivityLifecycle(this);
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }
}
