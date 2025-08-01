package so.onekey.app.wallet.splashscreen;

import android.widget.ImageView;

public enum SplashScreenImageResizeMode {
    CONTAIN(ImageView.ScaleType.FIT_CENTER, "contain"),
    COVER(ImageView.ScaleType.CENTER_CROP, "cover"),
    NATIVE(ImageView.ScaleType.CENTER, "native");

    private final ImageView.ScaleType scaleType;
    private final String resizeMode;

    SplashScreenImageResizeMode(ImageView.ScaleType scaleType, String resizeMode) {
        this.scaleType = scaleType;
        this.resizeMode = resizeMode;
    }

    public ImageView.ScaleType getScaleType() {
        return scaleType;
    }

    public static SplashScreenImageResizeMode fromString(String resizeMode) {
        if (resizeMode == null) {
            return null;
        }
        for (SplashScreenImageResizeMode mode : values()) {
            if (mode.resizeMode.equals(resizeMode)) {
                return mode;
            }
        }
        return null;
    }
} 