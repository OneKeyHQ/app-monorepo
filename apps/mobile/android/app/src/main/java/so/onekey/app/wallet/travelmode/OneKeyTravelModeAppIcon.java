package so.onekey.app.wallet.travelmode;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import java.util.Arrays;

public final class OneKeyTravelModeAppIcon {
    private OneKeyTravelModeAppIcon() {}

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
