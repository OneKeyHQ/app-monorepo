package so.onekey.app.wallet;

import android.content.ComponentCallbacks2;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.modules.i18nmanager.I18nUtil;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

import expo.modules.ReactActivityDelegateWrapper;
import expo.modules.splashscreen.SplashScreenManager;
import so.onekey.app.wallet.splashscreen.SplashScreenImageResizeMode;
import so.onekey.app.wallet.splashscreen.SplashScreenPackage;
import so.onekey.app.wallet.splashscreen.SplashScreenReactActivityLifecycleListener;
import so.onekey.app.wallet.splashscreen.SplashScreenViewController;
import so.onekey.app.wallet.splashscreen.singletons.SplashScreen;

public class MainActivity extends ReactActivity {
    private FileLoggerModule fileLogger;
    SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
    private volatile boolean isLowMemory = false;

    private SplashScreenImageResizeMode getResizeMode(Context context) {
    String resizeModeString = context.getString(R.string.expo_splash_screen_resize_mode).toLowerCase();
    SplashScreenImageResizeMode mode = SplashScreenImageResizeMode.fromString(resizeModeString);
    return mode != null ? mode : SplashScreenImageResizeMode.CONTAIN;
  }

  private boolean getStatusBarTranslucent(Context context) {
    return Boolean.parseBoolean(context.getString(R.string.expo_splash_screen_status_bar_translucent));
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
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
    super.onCreate(null);
    setTheme(R.style.AppTheme);
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        SplashScreen.INSTANCE.show(
                this,
                getResizeMode(this),
                ReactRootView.class,
                getStatusBarTranslucent(this)
        );
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
    fileLogger = new FileLoggerModule((ReactApplicationContext) getReactHost().getCurrentReactContext());
  }

  @Override
  public void onTrimMemory(int level) {
    super.onTrimMemory(level);
    isLowMemory = level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW;
  }

  @Override
  protected void onSaveInstanceState(@NonNull Bundle outState) {
    if (isLowMemory) {
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
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => " + messages.get(0) + ": " + messages.get(1));
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
