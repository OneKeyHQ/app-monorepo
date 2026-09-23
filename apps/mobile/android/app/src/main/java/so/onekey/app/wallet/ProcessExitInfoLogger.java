package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.RequiresApi;

import com.margelo.nitro.nativelogger.OneKeyLog;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Logs why previous app processes died, using the system's
 * ApplicationExitInfo records (API 30+).
 *
 * Many process deaths leave nothing in our own logs or in Sentry: the
 * process is SIGKILLed by the system. The most common example is an
 * Android System WebView update from Google Play, which kills every
 * process that loaded the WebView provider (React Native networking loads
 * it through CookieManager). The exit reason is the only evidence of
 * these deaths, so we write it to the local log on the next launch.
 */
final class ProcessExitInfoLogger {

    private static final String TAG = "ProcessExit";
    private static final String PREFS_NAME = "onekey_process_exit_info";
    private static final String KEY_LAST_LOGGED_TIMESTAMP = "last_logged_timestamp";
    private static final int MAX_RECORDS = 16;
    private static final int MAX_DESCRIPTION_LENGTH = 300;

    private ProcessExitInfoLogger() {}

    /** Reads exit records off the main thread; the query is a binder call. */
    static void logAsync(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return;
        }
        Context appContext = context.getApplicationContext();
        Thread thread = new Thread(() -> {
            try {
                logNewExitRecords(appContext);
            } catch (Throwable error) {
                OneKeyLog.warn(TAG, "failed to read exit info: " + error);
            }
        }, "onekey-exit-info");
        thread.setPriority(Thread.MIN_PRIORITY);
        thread.start();
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static void logNewExitRecords(Context context) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) {
            return;
        }
        String packageName = context.getPackageName();
        List<ApplicationExitInfo> records =
            am.getHistoricalProcessExitReasons(packageName, 0, MAX_RECORDS);
        if (records == null || records.isEmpty()) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastLogged = prefs.getLong(KEY_LAST_LOGGED_TIMESTAMP, 0L);
        long newest = lastLogged;

        // Records are newest first; log oldest first so the log reads in order.
        for (int i = records.size() - 1; i >= 0; i--) {
            ApplicationExitInfo info = records.get(i);
            long timestamp = info.getTimestamp();
            if (timestamp <= lastLogged) {
                continue;
            }
            newest = Math.max(newest, timestamp);
            // WebView sandboxed renderers are attributed to our package but
            // are named after the WebView package; their deaths are noise.
            String processName = info.getProcessName();
            if (processName == null || !processName.startsWith(packageName)) {
                continue;
            }
            logRecord(info);
        }

        if (newest > lastLogged) {
            prefs.edit().putLong(KEY_LAST_LOGGED_TIMESTAMP, newest).apply();
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static void logRecord(ApplicationExitInfo info) {
        int reason = info.getReason();
        String description = info.getDescription();
        boolean webViewUpdate = isWebViewUpdate(reason, description);

        StringBuilder message = new StringBuilder()
            .append("reason=").append(reasonName(reason)).append('(').append(reason).append(')')
            .append(", process=").append(info.getProcessName())
            .append(", pid=").append(info.getPid())
            .append(", time=").append(formatTimestamp(info.getTimestamp()))
            .append(", importance=").append(info.getImportance())
            .append(", status=").append(info.getStatus())
            .append(", pssKb=").append(info.getPss())
            .append(", rssKb=").append(info.getRss())
            .append(", webViewUpdate=").append(webViewUpdate)
            .append(", description=").append(truncate(description));

        if (webViewUpdate || isAbnormal(reason)) {
            OneKeyLog.warn(TAG, message.toString());
        } else {
            OneKeyLog.info(TAG, message.toString());
        }
    }

    // Example description: "stop com.google.android.webview due to installPackageLI".
    private static boolean isWebViewUpdate(int reason, String description) {
        if (description == null) {
            return false;
        }
        boolean packageKill = reason == ApplicationExitInfo.REASON_PACKAGE_UPDATED
            || reason == ApplicationExitInfo.REASON_DEPENDENCY_DIED;
        return packageKill
            && (description.contains("com.google.android.webview")
                || description.contains("com.android.webview")
                || description.contains("com.google.android.trichromelibrary"));
    }

    private static boolean isAbnormal(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_CRASH:
            case ApplicationExitInfo.REASON_CRASH_NATIVE:
            case ApplicationExitInfo.REASON_ANR:
            case ApplicationExitInfo.REASON_LOW_MEMORY:
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:
            case ApplicationExitInfo.REASON_DEPENDENCY_DIED:
            case ApplicationExitInfo.REASON_PACKAGE_UPDATED:
                return true;
            default:
                return false;
        }
    }

    private static String reasonName(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_EXIT_SELF: return "EXIT_SELF";
            case ApplicationExitInfo.REASON_SIGNALED: return "SIGNALED";
            case ApplicationExitInfo.REASON_LOW_MEMORY: return "LOW_MEMORY";
            case ApplicationExitInfo.REASON_CRASH: return "CRASH";
            case ApplicationExitInfo.REASON_CRASH_NATIVE: return "CRASH_NATIVE";
            case ApplicationExitInfo.REASON_ANR: return "ANR";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: return "INITIALIZATION_FAILURE";
            case ApplicationExitInfo.REASON_PERMISSION_CHANGE: return "PERMISSION_CHANGE";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: return "EXCESSIVE_RESOURCE_USAGE";
            case ApplicationExitInfo.REASON_USER_REQUESTED: return "USER_REQUESTED";
            case ApplicationExitInfo.REASON_USER_STOPPED: return "USER_STOPPED";
            case ApplicationExitInfo.REASON_DEPENDENCY_DIED: return "DEPENDENCY_DIED";
            case ApplicationExitInfo.REASON_OTHER: return "OTHER";
            case ApplicationExitInfo.REASON_FREEZER: return "FREEZER";
            case ApplicationExitInfo.REASON_PACKAGE_STATE_CHANGE: return "PACKAGE_STATE_CHANGE";
            case ApplicationExitInfo.REASON_PACKAGE_UPDATED: return "PACKAGE_UPDATED";
            default: return "UNKNOWN";
        }
    }

    private static String formatTimestamp(long timestamp) {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS Z", Locale.US)
            .format(new Date(timestamp));
    }

    private static String truncate(String value) {
        if (value == null) {
            return "null";
        }
        return value.length() <= MAX_DESCRIPTION_LENGTH
            ? value
            : value.substring(0, MAX_DESCRIPTION_LENGTH) + "...";
    }
}
