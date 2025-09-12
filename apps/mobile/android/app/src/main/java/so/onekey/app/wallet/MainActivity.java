package so.onekey.app.wallet;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

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
      SplashScreenManager.INSTANCE.registerOnActivity(this);
    }
    I18nUtil sharedI18nUtilInstance = I18nUtil.getInstance();
    sharedI18nUtilInstance.allowRTL(getApplicationContext(), true);
    EventBus.getDefault().register(this);
    fileLogger = new FileLoggerModule((ReactApplicationContext) getReactHost().getCurrentReactContext());
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
