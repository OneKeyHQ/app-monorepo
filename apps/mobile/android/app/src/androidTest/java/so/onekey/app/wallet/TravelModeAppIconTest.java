package so.onekey.app.wallet;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.List;

import so.onekey.app.wallet.travelmode.OneKeyTravelModeAppIcon;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public class TravelModeAppIconTest {
    @Test
    public void switchingKeepsOneLauncherAndPreservesDeepLinks() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try {
            OneKeyTravelModeAppIcon.synchronize(context, false);
            assertLauncher(context, "StandardLauncher", R.mipmap.ic_launcher);
            OneKeyTravelModeAppIcon.synchronize(context, true);
            assertLauncher(context, "TravelModeLauncher", R.mipmap.ic_launcher_travel);
            OneKeyTravelModeAppIcon.synchronize(context, true);
            assertLauncher(context, "TravelModeLauncher", R.mipmap.ic_launcher_travel);

            Intent deepLink = new Intent(Intent.ACTION_VIEW,
                android.net.Uri.parse("onekey-wallet://test"));
            deepLink.addCategory(Intent.CATEGORY_BROWSABLE);
            deepLink.setPackage(context.getPackageName());
            ResolveInfo resolved = context.getPackageManager().resolveActivity(deepLink, 0);
            assertNotNull(resolved);
            assertEquals("so.onekey.app.wallet.MainLauncherActivity", resolved.activityInfo.name);

            OneKeyTravelModeAppIcon.synchronize(context, false);
            assertLauncher(context, "StandardLauncher", R.mipmap.ic_launcher);
        } finally {
            OneKeyTravelModeAppIcon.synchronize(context, false);
        }
    }

    private void assertLauncher(Context context, String name, int icon) throws Exception {
        PackageManager manager = context.getPackageManager();
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launcherIntent.setPackage(context.getPackageName());
        List<ResolveInfo> launchers = manager.queryIntentActivities(launcherIntent, 0);
        assertEquals(1, launchers.size());
        ActivityInfo launcher = launchers.get(0).activityInfo;
        assertEquals("so.onekey.app.wallet." + name, launcher.name);
        assertEquals(icon, launcher.icon);
        assertNotNull(launcher.loadIcon(manager));
        ActivityInfo target = manager.getActivityInfo(
            new ComponentName(context, MainLauncherActivity.class), 0
        );
        assertTrue(target.enabled);
    }
}
