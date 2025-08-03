package so.onekey.app.wallet.splashscreen;

import android.annotation.SuppressLint;
import android.content.Context;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.RelativeLayout;

// this needs to stay for versioning to work

@SuppressLint("ViewConstructor")
public class SplashScreenView extends RelativeLayout {
    
    private final ImageView imageView;

    public SplashScreenView(Context context) {
        super(context);
        
        imageView = new ImageView(context);
        imageView.setLayoutParams(new LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT
        ));

        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        addView(imageView);
    }

    public ImageView getImageView() {
        return imageView;
    }

    public void configureImageViewResizeMode(SplashScreenImageResizeMode resizeMode) {
        imageView.setScaleType(resizeMode.getScaleType());
        switch (resizeMode) {
            case NATIVE:
                // No additional configuration needed
                break;
            case CONTAIN:
                imageView.setAdjustViewBounds(true);
                break;
            case COVER:
                // No additional configuration needed
                break;
        }
    }
} 