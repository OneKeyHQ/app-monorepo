package so.onekey.app.wallet.travelmode;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.Log;

import java.util.Arrays;

import so.onekey.app.wallet.BaseMainApplication;
import so.onekey.app.wallet.R;

public final class OneKeyTravelModeAppIcon {
    private OneKeyTravelModeAppIcon() {}

    @SuppressWarnings("deprecation")
    public static void configureTaskDescription(Activity activity) {
        try {
            boolean enabled = ((BaseMainApplication) activity.getApplication())
                .isTravelModeMaskingData();
            if (!enabled) {
                return;
            }
            CharSequence title = activity.getTitle();
            String label = title == null ? null : title.toString();
            // Some launchers ignore resource-only task icons, including on
            // Android 16. Render the adaptive drawable for the bitmap API.
            ActivityManager manager = activity.getSystemService(ActivityManager.class);
            int size = manager.getLauncherLargeIconSize();
            Drawable drawable = activity.getDrawable(R.mipmap.ic_launcher_travel);
            if (drawable == null) {
                throw new IllegalStateException("Task icon drawable is unavailable");
            }
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(new Canvas(bitmap));
            activity.setTaskDescription(new ActivityManager.TaskDescription(label, bitmap));
        } catch (Exception error) {
            Log.e("TravelModeAppIcon", "Task icon configuration failed", error);
        }
    }

    public static void synchronizeBestEffort(Context context, boolean enabled) {
        try {
            synchronize(context, enabled);
        } catch (Exception error) {
            Log.e("TravelModeAppIcon", "Icon synchronization failed", error);
        }
    }

    public static synchronized void synchronize(Context context, boolean enabled) {
        PackageManager manager = context.getPackageManager();
        ComponentName standard = new ComponentName(
            context.getPackageName(), "so.onekey.app.wallet.StandardLauncher"
        );
        ComponentName travel = new ComponentName(
            context.getPackageName(), "so.onekey.app.wallet.TravelModeLauncher"
        );
        if (isEnabled(manager, standard, true) == !enabled &&
            isEnabled(manager, travel, false) == enabled) {
            return;
        }
        int on = PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        int off = PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        int flags = PackageManager.DONT_KILL_APP;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            manager.setComponentEnabledSettings(Arrays.asList(
                new PackageManager.ComponentEnabledSetting(standard, enabled ? off : on, flags),
                new PackageManager.ComponentEnabledSetting(travel, enabled ? on : off, flags)
            ));
        } else {
            // Enable the destination first so a failed update cannot remove
            // every launcher. The real activity stays enabled for deep links.
            manager.setComponentEnabledSetting(enabled ? travel : standard, on, flags);
            manager.setComponentEnabledSetting(enabled ? standard : travel, off, flags);
        }
    }

    private static boolean isEnabled(
        PackageManager manager, ComponentName component, boolean defaultEnabled
    ) {
        int state = manager.getComponentEnabledSetting(component);
        return state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
            ? defaultEnabled
            : state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }
}
