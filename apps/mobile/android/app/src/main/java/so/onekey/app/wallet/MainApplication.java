package so.onekey.app.wallet;

import android.app.Activity;
import android.app.Application;
import android.net.Uri;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.CursorWindow;
import android.os.Bundle;

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

  // Anchored at the first line of onCreate(); used by MainActivity and the
  // ReactContext listener to compute "+Xms from app launch" deltas.
  public static long appLaunchMs = 0L;

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
    public synchronized ReactHost getReactHost() {
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

    private boolean isNativeBackgroundThreadEnabled() {
      return BuildConfig.ENABLE_NATIVE_BACKGROUND_THREAD;
    }

    /**
     * Feeds the host Activity's resume/pause/destroy signals to
     * {@link BackgroundThreadManager} so an allowlisted subset of bg-host
     * TurboModules (currently only react-native-google-signin) can observe
     * getCurrentActivity() on the bg ReactContext. The manager does NOT
     * fan out these events through ReactHost / ReactContext lifecycle
     * APIs — see the comment block in BackgroundThreadManager.kt for the
     * reasoning and tradeoffs.
     */
    private void registerBackgroundThreadActivityBridge() {
      if (!isNativeBackgroundThreadEnabled()) {
        return;
      }
      // Register FQCN prefixes of native modules whose ActivityEventListener
      // / LifecycleEventListener instances on the bg ReactHost are allowed
      // to receive bridged Activity events. Modules outside this list are
      // unaffected (preserve baseline "bg never resumed"). Each entry is a
      // cross-runtime decision — see the comment block in
      // BackgroundThreadManager.kt before adding new prefixes.
      BackgroundThreadManager.getInstance()
          .addBgActivityBridgeListenerClassPrefix("com.reactnativegooglesignin.");

      registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
        @Override public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) {}
        @Override public void onActivityStarted(@NonNull Activity activity) {}
        @Override
        public void onActivityResumed(@NonNull Activity activity) {
          BackgroundThreadManager.getInstance().dispatchActivityResumed(activity);
        }
        @Override
        public void onActivityPaused(@NonNull Activity activity) {
          BackgroundThreadManager.getInstance().dispatchActivityPaused(activity);
        }
        @Override public void onActivityStopped(@NonNull Activity activity) {}
        @Override public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) {}
        @Override
        public void onActivityDestroyed(@NonNull Activity activity) {
          BackgroundThreadManager.getInstance().dispatchActivityDestroyed(activity);
        }
      });
    }

    private void setupBackgroundThreadBootstrap() {
      if (!isNativeBackgroundThreadEnabled()) {
        OneKeyLog.info(
          "BackgroundThread",
          "setupBackgroundThreadBootstrap: disabled by ENABLE_NATIVE_BACKGROUND_THREAD"
        );
        return;
      }

      ReactHost reactHost = getReactHost();
      if (reactHost == null) {
        OneKeyLog.warn("BackgroundThread", "setupBackgroundThreadBootstrap: ReactHost is null");
        return;
      }

      reactHost.addReactInstanceEventListener(new ReactInstanceEventListener() {
        @Override
        public void onReactContextInitialized(ReactContext context) {
          OneKeyLog.info(
            "StartupTiming",
            "main_host.did_start: +" + (System.currentTimeMillis() - appLaunchMs) + "ms from launch (android)"
          );
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
          long tBeforeBgStart = System.currentTimeMillis();
          manager.setReactPackages(new PackageList(MainApplication.this).getPackages());
          manager.installSharedBridgeInMainRuntime(reactApplicationContext);

          String entryUrl = getBackgroundRunnerEntryUrl();
          OneKeyLog.info(
            "BackgroundThread",
            "onReactContextInitialized: start background runner with entryURL=" + entryUrl
          );
          manager.startBackgroundRunnerWithEntryURL(reactApplicationContext, entryUrl);
          OneKeyLog.info(
            "StartupTiming",
            "bg_runner.start: " + (System.currentTimeMillis() - tBeforeBgStart) + "ms (+" + (System.currentTimeMillis() - appLaunchMs) + "ms from launch) (android)"
          );
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
    appLaunchMs = System.currentTimeMillis();
    OneKeyLog.info("StartupTiming", "android.app.on_create.start: +0ms from launch (anchor)");

    // Log zygote→onCreate delay (API 24+, minSdk=24). This is the window
    // between process fork and our first Java code running: ART/dex2oat,
    // class loading, Application allocation.
    try {
      long processStartUptime = android.os.Process.getStartUptimeMillis();
      long nowUptime = android.os.SystemClock.uptimeMillis();
      OneKeyLog.info(
        "StartupTiming",
        "android.zygote_to_app_on_create: " + (nowUptime - processStartUptime) + "ms"
      );
    } catch (Throwable ignored) {}

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

    long tBeforeSuper = System.currentTimeMillis();
    super.onCreate();
    long tAfterSuper = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.super_on_create: " + (tAfterSuper - tBeforeSuper) + "ms"
    );

    // SoLoader and new architecture entry point must be initialized before
    // the recovery early-return because MainActivity extends ReactActivity,
    // and super.onCreate(null) triggers SoLoader.loadLibrary() and Fabric/
    // TurboModules initialization. Without these, recovery mode itself crashes.
    try {
        SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE);
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
    long tAfterSoLoader = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.so_loader_init: " + (tAfterSoLoader - tAfterSuper) + "ms"
    );
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load();
    }
    long tAfterNewArch = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.new_arch_load: " + (tAfterNewArch - tAfterSoLoader) + "ms (+" + (tAfterNewArch - appLaunchMs) + "ms from launch)"
    );

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
        // BUNDLE_VERSION value is a numeric string (e.g. "9197881"); AAPT
        // stores it as Integer in the metadata bundle, so getString() returns
        // the default. Read via get().toString() — same pattern as
        // ReactNativeBundleUpdate.kt#getBuiltinBundleVersion.
        Object bundleVersionObj = ai.metaData.get("BUNDLE_VERSION");
        builtinBundleVersion = bundleVersionObj != null ? bundleVersionObj.toString() : "";
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
    long tBeforeBg = System.currentTimeMillis();
    registerBackgroundThreadActivityBridge();
    setupBackgroundThreadBootstrap();
    long tAfterBg = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.bg_bootstrap: " + (tAfterBg - tBeforeBg) + "ms"
    );

    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    long tAfterExpo = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.expo_lifecycle: " + (tAfterExpo - tAfterBg) + "ms"
    );

    JPushModule.registerActivityLifecycle(this);
    long tDone = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.jpush_register: " + (tDone - tAfterExpo) + "ms"
    );
    OneKeyLog.info(
      "StartupTiming",
      "android.app.on_create.done: " + (tDone - appLaunchMs) + "ms (+" + (tDone - appLaunchMs) + "ms from launch)"
    );

    // ONEKEY_STARTUP_PROFILE: pre-read the main bundle file on a low-priority
    // background thread to attribute pure I/O time separately from RN's
    // combined read+parse+eval. Warms the OS page cache so the subsequent
    // RN load's measured time is effectively parse+eval only.
    if (BuildConfig.ONEKEY_STARTUP_PROFILE) {
      final long anchor = appLaunchMs;
      Thread hbcProbe = new Thread(() -> {
        long ioStart = System.currentTimeMillis();
        long size = 0;
        String[] candidates = new String[] {
          "index.android.bundle", "main.bundle"
        };
        for (String asset : candidates) {
          try (java.io.InputStream is = getAssets().open(asset)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = is.read(buf)) > 0) size += n;
            long ioMs = System.currentTimeMillis() - ioStart;
            OneKeyLog.info(
              "StartupProfile.hbc",
              "android." + asset + ": io=" + ioMs + "ms size=" + size + "B (prewarm, at +" + (System.currentTimeMillis() - anchor) + "ms from launch)"
            );
            break;
          } catch (Exception ignored) {
            // try next candidate
          }
        }
      }, "onekey-hbc-probe");
      hbcProbe.setPriority(Thread.MIN_PRIORITY);
      hbcProbe.start();
    }
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }
}
