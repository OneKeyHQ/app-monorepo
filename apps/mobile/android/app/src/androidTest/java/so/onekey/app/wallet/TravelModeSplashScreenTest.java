package so.onekey.app.wallet;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.TypedValue;
import android.view.ContextThemeWrapper;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 31)
public class TravelModeSplashScreenTest {
    @Test
    public void travelThemeRendersItsIconWithoutChangingTheStandardTheme() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        for (int size : new int[]{240, 360, 720}) {
            Bitmap standardBefore = renderSplashIcon(context, R.style.Theme_App_SplashScreen, size);
            Bitmap travel = renderSplashIcon(context, R.style.Theme_App_SplashScreen_TravelMode, size);
            Bitmap standardAfter = renderSplashIcon(context, R.style.Theme_App_SplashScreen, size);
            try {
                assertFalse(standardBefore.sameAs(travel));
                assertTrue(standardBefore.sameAs(standardAfter));
                assertTrue(hasOrangeArtwork(travel));
                assertFalse(hasOrangeArtwork(standardBefore));
                assertTrue(Math.abs(opaqueWidth(standardBefore) - opaqueWidth(travel)) <= 2);
                assertTrue(foregroundOverlap(standardBefore, travel) > 0.95);
            } finally {
                standardBefore.recycle();
                travel.recycle();
                standardAfter.recycle();
            }
        }
    }

    private Bitmap renderSplashIcon(Context context, int theme, int size) {
        Context themed = new ContextThemeWrapper(context, theme);
        TypedValue value = new TypedValue();
        assertTrue(themed.getTheme().resolveAttribute(
            android.R.attr.windowSplashScreenAnimatedIcon, value, true
        ));
        Drawable drawable = themed.getDrawable(value.resourceId);
        assertNotNull(drawable);
        assertTrue(drawable.getIntrinsicWidth() > 0);
        assertTrue(drawable.getIntrinsicHeight() > 0);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        // The system changes drawable bounds before rasterizing the starting icon.
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);
        return bitmap;
    }

    private boolean hasOrangeArtwork(Bitmap bitmap) {
        int orangePixels = 0;
        for (int y = 0; y < bitmap.getHeight(); y++) {
            for (int x = 0; x < bitmap.getWidth(); x++) {
                int color = bitmap.getPixel(x, y);
                int alpha = (color >>> 24) & 255;
                int red = (color >>> 16) & 255;
                int green = (color >>> 8) & 255;
                int blue = color & 255;
                if (alpha > 200 && red > 220 && green > 70 && green < 180 && blue < 90) {
                    orangePixels++;
                }
            }
        }
        return orangePixels > 100;
    }

    private int opaqueWidth(Bitmap bitmap) {
        int left = bitmap.getWidth();
        int right = -1;
        for (int y = 0; y < bitmap.getHeight(); y++) {
            for (int x = 0; x < bitmap.getWidth(); x++) {
                if ((bitmap.getPixel(x, y) >>> 24) > 128) {
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                }
            }
        }
        return Math.max(0, right - left + 1);
    }

    private double foregroundOverlap(Bitmap first, Bitmap second) {
        int intersection = 0;
        int union = 0;
        for (int y = 0; y < first.getHeight(); y++) {
            for (int x = 0; x < first.getWidth(); x++) {
                boolean firstOpaque = (first.getPixel(x, y) >>> 24) > 128;
                boolean secondOpaque = (second.getPixel(x, y) >>> 24) > 128;
                if (firstOpaque && secondOpaque) {
                    intersection++;
                }
                if (firstOpaque || secondOpaque) {
                    union++;
                }
            }
        }
        return union == 0 ? 0 : (double) intersection / union;
    }
}
