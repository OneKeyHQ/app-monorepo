package so.onekey.app.wallet.splashscreen;

import android.content.Context;
import android.view.View;
import androidx.core.content.ContextCompat;
import so.onekey.app.wallet.R;

// this needs to stay for versioning to work
// EXPO_VERSIONING_NEEDS_PACKAGE_R

/**
 * Default implementation that uses native resources.
 */
public class NativeResourcesBasedSplashScreenViewProvider implements SplashScreenViewProvider {
    
    private final SplashScreenImageResizeMode resizeMode;

    public NativeResourcesBasedSplashScreenViewProvider(SplashScreenImageResizeMode resizeMode) {
        this.resizeMode = resizeMode;
    }

    @Override
    public View createSplashScreenView(Context context) {
        SplashScreenView splashScreenView = new SplashScreenView(context);
        splashScreenView.setBackgroundColor(getBackgroundColor(context));

        splashScreenView.getImageView().setImageResource(getImageResource());
        splashScreenView.configureImageViewResizeMode(resizeMode);

        return splashScreenView;
    }

    private int getBackgroundColor(Context context) {
        return ContextCompat.getColor(context, R.color.splashscreen_background);
    }

    private int getImageResource() {
        if (resizeMode == SplashScreenImageResizeMode.NATIVE) {
            return R.drawable.splashscreen;
        }
        return R.drawable.splashscreen_image;
    }
} 