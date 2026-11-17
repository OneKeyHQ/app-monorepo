package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.os.SystemClock;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.List;

import so.onekey.app.wallet.travelmode.OneKeyTravelModeAppIcon;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@RunWith(AndroidJUnit4.class)
public class TravelModeAppIconTest {
    @Test
    public void launcherTaskUsesStableActivityIdentity() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ActivityManager manager = context.getSystemService(ActivityManager.class);
        for (ActivityManager.AppTask task : manager.getAppTasks()) {
            task.finishAndRemoveTask();
        }
        Intent launcher = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        assertNotNull(launcher);
        launcher.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        context.startActivity(launcher);

        ComponentName main = new ComponentName(context, MainActivity.class);
        long deadline = SystemClock.uptimeMillis() + 15_000L;
        while (SystemClock.uptimeMillis() < deadline) {
            for (ActivityManager.AppTask task : manager.getAppTasks()) {
                ActivityManager.RecentTaskInfo info = task.getTaskInfo();
                if (main.equals(info.topActivity) && info.numActivities == 1) {
                    // Disabling a launcher alias removes any task whose base
                    // intent still names that alias, even during a restart.
                    assertEquals(
                        new ComponentName(context, MainLauncherActivity.class),
                        info.baseIntent.getComponent()
                    );
                    boolean travelMode = ((BaseMainApplication) context.getApplicationContext())
                        .isTravelModeMaskingData();
                    Bitmap taskIcon = info.taskDescription.getIcon();
                    if (travelMode) {
                        if (taskIcon == null) {
                            continue;
                        }
                        assertTrue(hasOrangeArtwork(taskIcon));
                        assertEquals(context.getString(R.string.app_name), info.taskDescription.getLabel());
                    } else {
                        assertNull("Standard mode should use its default task icon", taskIcon);
                    }
                    return;
                }
            }
            SystemClock.sleep(100L);
        }
        fail("The launcher task did not become ready with its profile icon");
    }

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

    private boolean hasOrangeArtwork(Bitmap bitmap) {
        for (int y = 0; y < bitmap.getHeight(); y++) {
            for (int x = 0; x < bitmap.getWidth(); x++) {
                int color = bitmap.getPixel(x, y);
                int alpha = (color >>> 24) & 255;
                int red = (color >>> 16) & 255;
                int green = (color >>> 8) & 255;
                int blue = color & 255;
                if (alpha > 200 && red > 220 && green > 70 && green < 180 && blue < 90) {
                    return true;
                }
            }
        }
        return false;
    }
}
