package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;

import androidx.annotation.NonNull;

import com.backgroundthread.BackgroundThreadManager;
import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativesplashscreen.SplashScreenBridge;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.modules.i18nmanager.I18nUtil;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

import java.util.List;

import expo.modules.ReactActivityDelegateWrapper;
import expo.modules.splashscreen.SplashScreenManager;

public class MainActivity extends ReactActivity {
  private static boolean hasCreatedInstance;

  private static final class RecoveryReactActivityDelegate extends ReactActivityDelegate {
    RecoveryReactActivityDelegate(ReactActivity activity) {
      super(activity, null);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {}

    @Override
    public void onPause() {}

    @Override
    public void onResume() {}

    @Override
    public void onDestroy() {}

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {}

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
      return false;
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
      return false;
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
      return false;
    }

    @Override
    public boolean onBackPressed() {
      return false;
    }

    @Override
    public boolean onNewIntent(Intent intent) {
      return false;
    }

    @Override
    public void onUserLeaveHint() {}

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {}

    @Override
    public void onConfigurationChanged(Configuration newConfig) {}

    @Override
    public void onRequestPermissionsResult(
      int requestCode,
      String[] permissions,
      int[] grantResults
    ) {}
  }

  static boolean hasCreatedInstance() {
    return hasCreatedInstance;
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    if (MainApplication.shouldShowRecovery) {
      // ReactActivity requires super.onCreate(), but its normal delegate would
      // access the ReactHost after Application intentionally skipped RN setup.
      super.onCreate(null);
      startActivity(new Intent(this, RecoveryActivity.class));
      finish();
      return;
    }

    hasCreatedInstance = true;
    long tActivityStart = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.activity.on_create.start: +" + (tActivityStart - MainApplication.appLaunchMs) + "ms from launch"
    );
    // Install AndroidX SplashScreen before super.onCreate() to fix MIUI/HyperOS crashes
    // where system's replaceUmiTheme method fails with NullPointerException
    // Added defensive error handling for OPPO and other vendor-specific crashes
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        androidx.core.splashscreen.SplashScreen splashScreen = androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        // Add custom exit animation listener to catch and handle SurfaceControl crashes
        // This prevents NullPointerException during splash screen transition on OPPO/MIUI devices
        splashScreen.setOnExitAnimationListener(splashScreenView -> {
          try {
            // Immediately remove the splash screen without animation to avoid SurfaceControl issues
            if (splashScreenView != null && splashScreenView.getView() != null) {
              splashScreenView.remove();
            }
          } catch (Exception e) {
            Log.e("MainActivity", "Error during splash screen exit animation", e);
            // Fallback: try to remove the view directly
            try {
              if (splashScreenView != null && splashScreenView.getView() != null && splashScreenView.getView().getParent() != null) {
                ((android.view.ViewGroup) splashScreenView.getView().getParent()).removeView(splashScreenView.getView());
              }
            } catch (Exception fallbackError) {
              Log.e("MainActivity", "Fallback splash screen removal also failed", fallbackError);
            }
          }
        });
      } catch (Exception e) {
        Log.e("MainActivity", "Failed to install AndroidX splash screen, will use fallback", e);
        // If AndroidX splash screen fails, we'll rely on the Expo splash screen as fallback
      }
    }
    ((MainApplication) getApplication())
      .startBackgroundThreadIfNeeded("main_activity_pre_super");

    long tBeforeSuper = System.currentTimeMillis();
    super.onCreate(null);
    long tAfterSuper = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.activity.super_on_create: " + (tAfterSuper - tBeforeSuper) + "ms (ReactActivity init)"
    );

    setTheme(R.style.AppTheme);
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        SplashScreenBridge.show(this);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        SplashScreenManager.INSTANCE.registerOnActivity(this);
      } catch (Exception e) {
        Log.e("MainActivity", "Failed to register SplashScreenManager", e);
        // Continue without splash screen manager if it fails
      }
    }
    I18nUtil sharedI18nUtilInstance = I18nUtil.getInstance();
    sharedI18nUtilInstance.allowRTL(getApplicationContext(), true);
    EventBus.getDefault().register(this);

    long tActivityDone = System.currentTimeMillis();
    OneKeyLog.info(
      "StartupTiming",
      "android.activity.on_create.done: " + (tActivityDone - tActivityStart) + "ms (+" + (tActivityDone - MainApplication.appLaunchMs) + "ms from launch)"
    );
  }

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    // super -> ReactActivityDelegate drives the UI-host ReactContext's
    // ActivityEventListener fan-out in the normal RN path.
    super.onActivityResult(requestCode, resultCode, data);
    if (MainApplication.shouldShowRecovery) {
      return;
    }
    // Manager re-dispatches only to an allowlisted subset of listeners on
    // the bg ReactContext (see BackgroundThreadManager.bgActivityListenerClassAllowlist).
    // This lets google-signin's bg instance resolve its pending signIn
    // promise without leaking the event to every other bg module.
    BackgroundThreadManager.getInstance()
        .dispatchActivityResult(this, requestCode, resultCode, data);
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (MainApplication.shouldShowRecovery) {
      return;
    }
    BackgroundThreadManager.getInstance().dispatchNewIntent(intent);
  }

  @Override
  protected void onStop() {
    super.onStop();
    // Reset crash counter on graceful exit so normal close
    // is not mistaken for a crash on next boot.
    // Skip reset when already in recovery mode (count >= 3) so recovery
    // is still offered if the user swipe-kills without resolving.
    SharedPreferences prefs = getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE);
    int count = prefs.getInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0);
    if (count < BootRecoveryKeys.RECOVERY_THRESHOLD) {
      prefs.edit()
          .putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0)
          .commit();
    }
  }

  @Override
  protected void onDestroy() {
    hasCreatedInstance = false;
    super.onDestroy();
  }

  @Override
  protected void onSaveInstanceState(@NonNull Bundle outState) {
    ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
    ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
    am.getMemoryInfo(memInfo);
    if (memInfo.lowMemory) {
      // Skip expensive state serialization to prevent ANR on low-memory devices.
      // This is safe because we pass null to super.onCreate(), so saved state
      // is never restored. React Native manages its own state via JavaScript.
      return;
    }
    super.onSaveInstanceState(outState);
  }

    @Subscribe(threadMode = ThreadMode.ASYNC)
    public void onLogEvent(Object event)
    {
        List<String> messages = (List<String>) event;
        OneKeyLog.info("App", "native => " + messages.get(0) + ": " + messages.get(1));
    };


  /**
   * Returns the name of the main component registered from JavaScript.
   * This is used to schedule rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "main";
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
   * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
   * (aka React 18) with two boolean flags.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    if (MainApplication.shouldShowRecovery) {
      return new RecoveryReactActivityDelegate(this);
    }
    return new ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled()));
  }

  /**
   * Align the back button behavior with Android S
   * where moving root activities to background instead of finishing activities.
   * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
   */
  @Override
  public void invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        // For non-root activities, use the default implementation to finish them.
        super.invokeDefaultOnBackPressed();
      }
      return;
    }

    // Use the default back button implementation on Android S
    // because it's doing more than {@link Activity#moveTaskToBack} in fact.
    super.invokeDefaultOnBackPressed();
  }
}
