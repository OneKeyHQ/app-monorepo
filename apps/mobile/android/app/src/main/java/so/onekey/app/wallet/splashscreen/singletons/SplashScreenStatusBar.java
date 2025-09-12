package so.onekey.app.wallet.splashscreen.singletons;

import android.app.Activity;
import androidx.core.view.ViewCompat;
import android.view.View;
import android.view.WindowInsets;

public class SplashScreenStatusBar {
    public static final SplashScreenStatusBar INSTANCE = new SplashScreenStatusBar();

    private SplashScreenStatusBar() {
        // Private constructor for singleton
    }

    public void configureTranslucent(Activity activity, Boolean translucent) {
        if (translucent != null) {
            activity.runOnUiThread(() -> {
                // If the status bar is translucent hook into the window insets calculations
                // and consume all the top insets so no padding will be added under the status bar.
                View decorView = activity.getWindow().getDecorView();
                if (translucent) {
                    decorView.setOnApplyWindowInsetsListener((v, insets) -> {
                        WindowInsets defaultInsets = v.onApplyWindowInsets(insets);
                        return defaultInsets.replaceSystemWindowInsets(
                            defaultInsets.getSystemWindowInsetLeft(),
                            0,
                            defaultInsets.getSystemWindowInsetRight(),
                            defaultInsets.getSystemWindowInsetBottom()
                        );
                    });
                } else {
                    decorView.setOnApplyWindowInsetsListener(null);
                }
                ViewCompat.requestApplyInsets(decorView);
            });
        }
    }
} 
