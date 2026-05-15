package so.onekey.app.wallet;

import android.content.SharedPreferences;

import com.margelo.nitro.nativelogger.OneKeyLog;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Single source of truth for the Activity-stage boot-failure tracking
 * used by BootRecovery. All SharedPreferences access for the time-windowed
 * counter lives here so that MainActivity / MainApplication / RecoveryActivity
 * never touch the raw keys directly — adding a new reset path is a single
 * call here, not a hunt across files.
 *
 * Why integer + timestamp list instead of just timestamps:
 *   The JS-side `markBootSuccess` is exposed via the @onekeyfe/react-native-
 *   device-utils Nitro module (lives in node_modules) and only writes the
 *   integer. Piggy-backing the "timestamps are stale" signal on `integer == 0`
 *   keeps that external module unchanged while still giving every existing
 *   reset path (Nitro markBootSuccess, MainActivity.onStop, RecoveryActivity,
 *   version migration) the correct invalidation behaviour for free.
 */
final class BootRecoveryStore {

    // Cap retained timestamps. We only need to distinguish "< RECOVERY_THRESHOLD"
    // from ">= RECOVERY_THRESHOLD"; retaining slightly more provides graceful
    // overflow if increments happen faster than expected.
    private static final int MAX_RETAINED = 5;

    private BootRecoveryStore() {}

    /**
     * Records a new MainActivity.onCreate attempt and returns the post-write
     * windowed count. Caller uses the return value to decide whether to
     * route this launch into RecoveryActivity.
     */
    static int recordBootAttempt(SharedPreferences prefs) {
        long now = System.currentTimeMillis();
        int oldInteger = prefs.getInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0);
        // integer == 0 ⇒ a reset path zeroed us; discard stale timestamps.
        List<Long> timestamps = (oldInteger > 0)
            ? parseTimestamps(prefs.getString(BootRecoveryKeys.BOOT_FAIL_TIMESTAMPS, ""))
            : new ArrayList<>();
        dropOutsideWindow(timestamps, now);
        timestamps.add(now);
        while (timestamps.size() > MAX_RETAINED) {
            timestamps.remove(0);
        }
        int newInteger = oldInteger + 1;
        prefs.edit()
            .putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, newInteger)
            .putString(BootRecoveryKeys.BOOT_FAIL_TIMESTAMPS, serializeTimestamps(timestamps))
            .commit();
        int windowedCount = timestamps.size();
        OneKeyLog.info(
            "BootRecovery",
            "boot_fail_count(activity): " + oldInteger + " -> " + newInteger
                + ", windowed=" + windowedCount
        );
        return windowedCount;
    }

    /**
     * Reads the windowed failure count WITHOUT recording a new attempt.
     * Returns 0 if the freshness signal says timestamps are stale.
     */
    static int readWindowedCount(SharedPreferences prefs) {
        int integer = prefs.getInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0);
        if (integer <= 0) return 0;
        List<Long> timestamps = parseTimestamps(
            prefs.getString(BootRecoveryKeys.BOOT_FAIL_TIMESTAMPS, "")
        );
        dropOutsideWindow(timestamps, System.currentTimeMillis());
        return timestamps.size();
    }

    private static void dropOutsideWindow(List<Long> timestamps, long now) {
        Iterator<Long> it = timestamps.iterator();
        while (it.hasNext()) {
            if (now - it.next() > BootRecoveryKeys.ACTIVITY_FAIL_WINDOW_MS) {
                it.remove();
            }
        }
    }

    private static List<Long> parseTimestamps(String raw) {
        List<Long> result = new ArrayList<>();
        if (raw == null || raw.isEmpty()) return result;
        for (String part : raw.split(",")) {
            try {
                long t = Long.parseLong(part.trim());
                if (t > 0) result.add(t);
            } catch (NumberFormatException ignored) {
                // skip malformed token
            }
        }
        return result;
    }

    private static String serializeTimestamps(List<Long> timestamps) {
        if (timestamps.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(timestamps.size() * 14);
        for (int i = 0; i < timestamps.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(timestamps.get(i));
        }
        return sb.toString();
    }
}
