package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.RequiresApi;

import com.margelo.nitro.nativelogger.OneKeyLog;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

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
    private static final String KEY_LOGGED_RECORDS = "logged_records";
    private static final int MAX_DESCRIPTION_LENGTH = 300;
    private static final String[] WEBVIEW_PACKAGE_PREFIXES = {
        "com.google.android.webview",
        "com.android.webview",
        // Trichrome library packages are versioned, e.g. trichromelibrary_787112633.
        "com.google.android.trichromelibrary",
    };

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
        // maxNum 0 returns the whole history the system keeps for this app.
        List<ApplicationExitInfo> records =
            am.getHistoricalProcessExitReasons(packageName, 0, 0);
        if (records == null || records.isEmpty()) {
            return;
        }

        // Dedupe by record identity rather than a timestamp watermark: record
        // timestamps are wall-clock time, so a clock moved backwards would
        // otherwise hide new records. The system history is bounded, so the
        // stored set stays small.
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> logged = prefs.getStringSet(KEY_LOGGED_RECORDS, Collections.emptySet());
        Set<String> current = new HashSet<>();
        List<ApplicationExitInfo> newRecords = new ArrayList<>();
        for (ApplicationExitInfo info : records) {
            String key = recordKey(info);
            current.add(key);
            if (logged.contains(key)) {
                continue;
            }
            // WebView sandboxed renderers are attributed to our package but
            // are named after the WebView package; their deaths are noise.
            String processName = info.getProcessName();
            if (processName != null && processName.startsWith(packageName)) {
                newRecords.add(info);
            }
        }

        newRecords.sort((a, b) -> Long.compare(a.getTimestamp(), b.getTimestamp()));
        for (ApplicationExitInfo info : newRecords) {
            logRecord(info);
        }

        if (!current.equals(logged)) {
            prefs.edit().putStringSet(KEY_LOGGED_RECORDS, current).apply();
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static String recordKey(ApplicationExitInfo info) {
        return info.getTimestamp() + ":" + info.getPid() + ":" + info.getProcessName();
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

    // The system kills dependents of an updated package with the description
    // "stop <package> due to <reason>", e.g.
    // "stop com.google.android.webview due to installPackageLI". The reason
    // code differs by version: Android 14+ uses REASON_PACKAGE_UPDATED, while
    // Android 11-13 record the same kill as REASON_USER_REQUESTED.
    private static boolean isWebViewUpdate(int reason, String description) {
        if (description == null) {
            return false;
        }
        boolean packageKill = reason == ApplicationExitInfo.REASON_PACKAGE_UPDATED
            || reason == ApplicationExitInfo.REASON_USER_REQUESTED
            || reason == ApplicationExitInfo.REASON_DEPENDENCY_DIED;
        if (!packageKill) {
            return false;
        }
        for (String prefix : WEBVIEW_PACKAGE_PREFIXES) {
            if (description.contains("stop " + prefix)) {
                return true;
            }
        }
        return false;
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
