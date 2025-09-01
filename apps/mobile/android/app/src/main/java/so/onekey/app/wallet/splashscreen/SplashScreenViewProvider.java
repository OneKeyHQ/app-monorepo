package so.onekey.app.wallet.splashscreen;

import android.content.Context;
import android.view.View;

/**
 * This interface is responsible for providing properly configured SplashScreenView.
 */
public interface SplashScreenViewProvider {
    View createSplashScreenView(Context context);
} 