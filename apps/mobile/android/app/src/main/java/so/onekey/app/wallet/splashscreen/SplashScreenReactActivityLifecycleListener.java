package so.onekey.app.wallet.splashscreen;

import android.app.Activity;
import android.content.Context;
import com.facebook.react.ReactRootView;
import expo.modules.core.interfaces.ReactActivityLifecycleListener;
import so.onekey.app.wallet.R;
import so.onekey.app.wallet.splashscreen.singletons.SplashScreen;

// this needs to stay for versioning to work
// EXPO_VERSIONING_NEEDS_PACKAGE_R

public class SplashScreenReactActivityLifecycleListener implements ReactActivityLifecycleListener {
    
    public SplashScreenReactActivityLifecycleListener(Context activityContext) {
        // Constructor
    }
    
    @Override
    public void onContentChanged(Activity activity) {
    }

    private SplashScreenImageResizeMode getResizeMode(Context context) {
        String resizeModeString = context.getString(R.string.expo_splash_screen_resize_mode).toLowerCase();
        SplashScreenImageResizeMode mode = SplashScreenImageResizeMode.fromString(resizeModeString);
        return mode != null ? mode : SplashScreenImageResizeMode.CONTAIN;
    }

    private boolean getStatusBarTranslucent(Context context) {
        return Boolean.parseBoolean(context.getString(R.string.expo_splash_screen_status_bar_translucent));
    }
} 
