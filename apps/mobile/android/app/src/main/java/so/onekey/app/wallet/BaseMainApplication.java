package so.onekey.app.wallet;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.Application;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

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
import com.tencent.mmkv.MMKV;

import cn.jiguang.plugins.push.JPushModule;
import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import com.margelo.nitro.reactnativedeviceutils.ReactNativeDeviceUtils;
import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ExpoReactHostFactory;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.List;

import so.onekey.app.wallet.storage.OneKeyNativeStorageMigrationPackage;

public class BaseMainApplication extends Application implements ReactApplication {

  public static boolean shouldShowRecovery = false;

  // Anchored at the first line of onCreate(); used by MainActivity and the
  // ReactContext listener to compute "+Xms from app launch" deltas.
  public static long appLaunchMs = 0L;

  private final CustomReactNativeHost mReactNativeHost =
    new CustomReactNativeHost(this) {
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
  };
  @Nullable
  private ReactHost mReactHost;
  private boolean isDefaultMainProcess = true;

  protected static final class BuildVariantBundleInfo {
    final String commonBundlePath;
    final String fingerprint;
    final String mainEntryUrl;
    final String backgroundEntryUrl;

    protected BuildVariantBundleInfo(
      @NonNull String commonBundlePath,
      @NonNull String fingerprint,
      @NonNull String mainEntryUrl,
      @NonNull String backgroundEntryUrl
    ) {
      this.commonBundlePath = commonBundlePath;
      this.fingerprint = fingerprint;
      this.mainEntryUrl = mainEntryUrl;
      this.backgroundEntryUrl = backgroundEntryUrl;
    }
  }

  protected void configureBuildVariantRuntime() {}

  @Nullable
  protected BuildVariantBundleInfo getBuildVariantBundleInfo() {
    return null;
  }

  protected boolean startBuildVariantBackgroundRunner(
    @NonNull BackgroundThreadManager manager,
    @NonNull BuildVariantBundleInfo bundleInfo
  ) {
    return manager.ensureBackgroundRunnerWithEntryURL(
      getApplicationContext(),
      bundleInfo.backgroundEntryUrl
    );
  }

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

    @Nullable
    @Override
    public synchronized ReactHost getReactHost() {
        if (!isDefaultMainProcess) {
          Log.w("MainApplication", "Ignoring ReactHost access outside the default main process");
          return null;
        }
        if (mReactHost == null) {
          BuildVariantBundleInfo bundleInfo = getBuildVariantBundleInfo();
          mReactHost =
            ExpoReactHostFactory.getDefaultReactHost(
              this.getApplicationContext(),
              new PackageList(this).getPackages(),
              ".expo/.virtual-metro-entry",
              "index.android.bundle",
              mReactNativeHost.getJSBundleFile(),
              null,
              BuildConfig.DEBUG,
              null,
              bundleInfo == null ? null : bundleInfo.commonBundlePath,
              bundleInfo == null ? null : bundleInfo.mainEntryUrl,
              bundleInfo == null ? null : bundleInfo.fingerprint
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
      BuildVariantBundleInfo bundleInfo = getBuildVariantBundleInfo();
      if (bundleInfo != null) {
        return bundleInfo.backgroundEntryUrl;
      }
      if (BuildConfig.DEBUG) {
        String host = AndroidInfoHelpers.getServerHost(this);
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

    @Nullable
    private String getCurrentProcessNameCompat() {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        return Application.getProcessName();
      }

      ActivityManager activityManager =
        (ActivityManager) getSystemService(ACTIVITY_SERVICE);
      int currentPid = android.os.Process.myPid();
      if (activityManager != null) {
        List<ActivityManager.RunningAppProcessInfo> runningProcesses =
          activityManager.getRunningAppProcesses();
        if (runningProcesses != null) {
          for (ActivityManager.RunningAppProcessInfo processInfo : runningProcesses) {
            if (processInfo.pid == currentPid) {
              return processInfo.processName;
            }
          }
        }
      }

      try (BufferedReader reader = new BufferedReader(new FileReader("/proc/self/cmdline"))) {
        String processName = reader.readLine();
        if (processName != null) {
          processName = processName.replace("\u0000", "").trim();
          if (!processName.isEmpty()) {
            return processName;
          }
        }
      } catch (IOException error) {
        Log.w("MainApplication", "Unable to read /proc/self/cmdline", error);
      }
      return null;
    }

    private boolean resolveIsDefaultMainProcess() {
      String processName = getCurrentProcessNameCompat();
      if (processName == null || processName.isEmpty()) {
        Log.w(
          "MainApplication",
          "Unable to resolve process name; conservatively enabling main-process initialization"
        );
        return true;
      }
      boolean isMainProcess = getPackageName().equals(processName);
      Log.i(
        "MainApplication",
        "process=" + processName + ", mainProcess=" + isMainProcess
      );
      return isMainProcess;
    }

    public void startBackgroundThreadIfNeeded(@NonNull String trigger) {
      if (
        !isDefaultMainProcess ||
        shouldShowRecovery ||
        !isNativeBackgroundThreadEnabled()
      ) {
        return;
      }

      BackgroundThreadManager manager = BackgroundThreadManager.getInstance();
      String entryUrl = getBackgroundRunnerEntryUrl();
      BuildVariantBundleInfo bundleInfo = getBuildVariantBundleInfo();
      long startTime = System.currentTimeMillis();
      boolean startScheduled = bundleInfo == null
        ? manager.ensureBackgroundRunnerWithEntryURL(getApplicationContext(), entryUrl)
        : startBuildVariantBackgroundRunner(manager, bundleInfo);
      OneKeyLog.info(
        "BackgroundThread",
        "ensure background runner: trigger=" + trigger
          + ", scheduled=" + startScheduled
          + ", state=" + manager.getBackgroundRunnerState()
          + ", failure=" + manager.getBackgroundRunnerFailureMessage()
          + ", entryURL=" + entryUrl
      );
      OneKeyLog.info(
        "StartupTiming",
        "bg_runner.ensure: " + (System.currentTimeMillis() - startTime)
          + "ms (+" + (System.currentTimeMillis() - appLaunchMs)
          + "ms from launch, trigger=" + trigger + ") (android)"
      );
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

      BackgroundThreadManager manager = BackgroundThreadManager.getInstance();
      List<ReactPackage> backgroundPackages = new PackageList(this).getPackages();
      backgroundPackages.add(new OneKeyNativeStorageMigrationPackage());
      manager.setReactPackages(backgroundPackages);

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
          manager.installSharedBridgeInMainRuntime(reactApplicationContext);
          startBackgroundThreadIfNeeded("main_react_context_fallback");
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

    long tBeforeSuper = System.currentTimeMillis();
    super.onCreate();
    long tAfterSuper = System.currentTimeMillis();

    isDefaultMainProcess = resolveIsDefaultMainProcess();
    if (!isDefaultMainProcess) {
      return;
    }

    OneKeyLog.info("StartupTiming", "android.app.on_create.start: +0ms from launch (anchor)");
    OneKeyLog.info(
      "StartupTiming",
      "android.app.super_on_create: " + (tAfterSuper - tBeforeSuper) + "ms"
    );

    // Log zygote→onCreate delay (API 26+, minSdk=26). This is the window
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

    // Version-aware counter reset — clears the Activity-stage counter when
    // the installed app version changes (an upgrade resets the crash-loop
    // history because the failing code path may be gone). Timestamps don't
    // need an explicit clear; the freshness signal (integer == 0) handles it.
    String currentVersion = BuildConfig.VERSION_NAME;
    String storedVersion = prefs.getString(BootRecoveryKeys.BOOT_FAIL_APP_VERSION, "");
    if (!storedVersion.isEmpty() && !storedVersion.equals(currentVersion)) {
        prefs.edit()
            .putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0)
            .commit();
    }
    prefs.edit().putString(BootRecoveryKeys.BOOT_FAIL_APP_VERSION, currentVersion).commit();

    // Harness tests create this marker file via globalSetup so the recovery
    // page never blocks React Native from starting during test runs.
    boolean isHarnessMode = new java.io.File(getFilesDir(), "harness_mode").exists();

    // Read-only here. MainApplication never increments — that's MainLauncherActivity's
    // job (`recordBootAttempt`). System-initiated process launches (JPush
    // wakeups, foreground-service callbacks, broadcast receivers, post-
    // download relaunches) run Application.onCreate but NOT MainLauncherActivity,
    // so the counter stays untouched and bg-launches don't count as failures.
    //
    // No +1 prediction either: predicting `(windowed + 1) >= threshold` would
    // skip RN/JPush init on bg-launches when the previous user-launches were
    // already approaching the threshold, silently dropping the wakeup. We
    // take the small cost of Application initialization on the strike that
    // triggers recovery. MainLauncherActivity records the user launch and
    // routes to RecoveryActivity without constructing a ReactActivity.
    int windowedFailures = BootRecoveryStore.readWindowedCount(prefs);
    shouldShowRecovery = !isHarnessMode
        && windowedFailures >= BootRecoveryKeys.RECOVERY_THRESHOLD;

    OneKeyLog.info(
      "BootRecovery",
      "boot_fail_count(activity.windowed): " + windowedFailures
        + ", shouldShowRecovery: " + shouldShowRecovery
    );

    if (shouldShowRecovery) {
        // MainLauncherActivity and RecoveryActivity are plain native activities.
        // Keep the recovery path independent from React Native initialization.
        return;
    }

    long tBeforeSoLoader = System.currentTimeMillis();
    try {
        SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE);
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
    long tAfterSoLoader = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.so_loader_init: " + (tAfterSoLoader - tBeforeSoLoader) + "ms"
    );
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load();
    }
    long tAfterNewArch = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.app.new_arch_load: " + (tAfterNewArch - tAfterSoLoader) + "ms (+" + (tAfterNewArch - appLaunchMs) + "ms from launch)"
    );

    configureBuildVariantRuntime();

    // The migration bridge uses MMKV's Java wrapper, whose initialization
    // state is separate from the Nitro C++ factory used by react-native-mmkv.
    MMKV.initialize(this);

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
    if (isDefaultMainProcess && !shouldShowRecovery) {
      ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
    }
  }
}
