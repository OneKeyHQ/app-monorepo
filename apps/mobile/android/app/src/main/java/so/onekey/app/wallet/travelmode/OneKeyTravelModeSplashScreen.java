package so.onekey.app.wallet.travelmode;

import android.app.Activity;
import android.content.res.Resources;
import android.os.Build;
import android.util.Log;

import so.onekey.app.wallet.BaseMainApplication;
import so.onekey.app.wallet.R;

public final class OneKeyTravelModeSplashScreen {
    private OneKeyTravelModeSplashScreen() {}

    public static boolean configureLaunch(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            BaseMainApplication.shouldShowRecovery) {
            return false;
        }
        boolean enabled = ((BaseMainApplication) activity.getApplication())
            .isTravelModeMaskingData();
        activity.setTheme(enabled
            ? R.style.Theme_App_SplashScreen_TravelMode
            : R.style.Theme_App_SplashScreen);
        synchronizeBestEffort(activity, enabled);
        return enabled;
    }

    public static void synchronize(Activity activity, boolean enabled) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return;
        }
        if (activity == null || activity.isDestroyed() || activity.isFinishing()) {
            throw new IllegalStateException("Splash screen activity is unavailable");
        }
        // Android persists this theme by name for the next starting window,
        // including cold launches before either RN runtime has initialized.
        activity.getSplashScreen().setSplashScreenTheme(enabled
            ? R.style.Theme_App_SplashScreen_TravelMode
            : Resources.ID_NULL);
    }

    public static void synchronizeBestEffort(Activity activity, boolean enabled) {
        try {
            synchronize(activity, enabled);
        } catch (Exception error) {
            Log.e("TravelModeSplashScreen", "Splash theme synchronization failed", error);
        }
    }
}
