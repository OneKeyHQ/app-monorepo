package so.onekey.app.wallet.sentry;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONObject;

import io.sentry.EnvelopeReader;
import io.sentry.IEnvelopeReader;
import io.sentry.ISerializer;
import io.sentry.JsonSerializer;
import io.sentry.Sentry;
import io.sentry.SentryEnvelope;
import io.sentry.SentryEnvelopeItem;
import io.sentry.SentryEvent;
import io.sentry.SentryItemType;
import io.sentry.SentryOptions;
import io.sentry.SentryOptions.BeforeEnvelopeCallback;
import io.sentry.SentryOptions.BeforeSendCallback;
import io.sentry.android.core.SentryAndroidOptions;
import io.sentry.protocol.DebugImage;
import io.sentry.protocol.DebugMeta;
import io.sentry.protocol.Mechanism;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;
import io.sentry.protocol.SentryThread;
import io.sentry.react.RNSentrySDK;

@ReactModule(name = OneKeySentryCrashDiagnosticsModule.NAME)
public final class OneKeySentryCrashDiagnosticsModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OneKeySentryCrashDiagnostics";

    private static final int SCHEMA_VERSION = 1;
    private static final int MAX_REPORT_COUNT = 5;
    private static final int MAX_FRAME_COUNT = 256;
    private static final int MAX_PROCESS_EXIT_COUNT = 10;
    private static final int MAX_STRING_LENGTH = 1024;
    private static final int MAX_TRACE_LENGTH = 128 * 1024;
    private static final long MAX_REPORT_AGE_MS = 7L * 24L * 60L * 60L * 1000L;
    private static final Object INITIALIZATION_LOCK = new Object();
    private static final Object FILE_LOCK = new Object();
    private static boolean initialized;

    private static final List<Pattern> SENSITIVE_PATTERNS = Arrays.asList(
        Pattern.compile("(?:0x)?[0-9a-fA-F]{64}"),
        Pattern.compile("\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b"),
        Pattern.compile("\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b"),
        Pattern.compile("(?:\\b[a-z]{3,8}\\b[\\s,]+){11,}\\b[a-z]{3,8}\\b"),
        Pattern.compile("(?i)(?:Bearer|token[=:]?)\\s*[A-Za-z0-9_.\\-+/=]{20,}"),
        Pattern.compile("(?:eyJ|AAAA)[A-Za-z0-9+/=]{40,}")
    );

    public OneKeySentryCrashDiagnosticsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean initialize(ReadableMap configuration) {
        synchronized (INITIALIZATION_LOCK) {
            if (initialized || Sentry.isEnabled()) {
                initialized = true;
                return true;
            }

            String dsn = getString(configuration, "dsn", "");
            if (dsn.isEmpty()) {
                return false;
            }

            try {
                RNSentrySDK.init(
                    getReactApplicationContext(),
                    options -> configureOptions(options, configuration)
                );
                initialized = Sentry.isEnabled();
                return initialized;
            } catch (Throwable error) {
                android.util.Log.e(NAME, "Failed to initialize native Sentry diagnostics", error);
                return false;
            }
        }
    }

    private void configureOptions(
        SentryAndroidOptions options,
        ReadableMap configuration
    ) {
        options.setDsn(getString(configuration, "dsn", ""));
        options.setEnabled(getBoolean(configuration, "enabled", true));
        options.setMaxBreadcrumbs(getInt(configuration, "maxBreadcrumbs", 100));
        options.setMaxCacheItems(getInt(configuration, "maxCacheItems", 60));
        options.setAnrEnabled(
            getBoolean(configuration, "enableAppHangTracking", true)
        );
        options.setAnrTimeoutIntervalMillis(
            Math.round(
                getDouble(configuration, "appHangTimeoutInterval", 5.0) * 1000.0
            )
        );
        options.setEnableNdk(getBoolean(configuration, "enableNdk", true));
        options.setAttachScreenshot(
            getBoolean(configuration, "attachScreenshot", false)
        );
        options.setAttachViewHierarchy(
            getBoolean(configuration, "attachViewHierarchy", false)
        );
        options.setSendDefaultPii(
            getBoolean(configuration, "sendDefaultPii", false)
        );

        BeforeSendCallback existingBeforeSend = options.getBeforeSend();
        options.setBeforeSend((event, hint) -> {
            SentryEvent preparedEvent = existingBeforeSend == null
                ? event
                : existingBeforeSend.execute(event, hint);
            if (preparedEvent != null && preparedEvent.isCrashed()) {
                persistCrashEvent(
                    getReactApplicationContext(),
                    preparedEvent
                );
            }
            return preparedEvent;
        });

        BeforeEnvelopeCallback existingBeforeEnvelope =
            options.getBeforeEnvelopeCallback();
        options.setBeforeEnvelopeCallback((envelope, hint) -> {
            if (existingBeforeEnvelope != null) {
                existingBeforeEnvelope.execute(envelope, hint);
            }
            persistCrashEvents(
                getReactApplicationContext(),
                envelope,
                options.getSerializer()
            );
        });
    }

    public static void persistPendingNativeCrashEnvelopes(Context context) {
        cleanupReports(
            new File(context.getCacheDir(), "logs/crashes"),
            System.currentTimeMillis()
        );
        File sentryCache = new File(
            context.getCacheDir(),
            "sentry"
        );
        SentryOptions parsingOptions = new SentryOptions();
        ISerializer serializer = new JsonSerializer(parsingOptions);
        IEnvelopeReader envelopeReader = new EnvelopeReader(serializer);
        persistPendingNativeCrashEnvelopes(
            context,
            sentryCache,
            envelopeReader,
            serializer,
            0
        );
    }

    public static void persistHistoricalProcessExitDiagnostics(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return;
        }

        File directory = new File(context.getCacheDir(), "logs/crashes");
        long now = System.currentTimeMillis();
        cleanupReports(directory, now);
        try {
            ActivityManager activityManager =
                (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) {
                return;
            }
            List<ApplicationExitInfo> exits =
                activityManager.getHistoricalProcessExitReasons(
                    null,
                    0,
                    MAX_PROCESS_EXIT_COUNT
                );
            for (ApplicationExitInfo exit : exits) {
                if (
                    !isRelevantExitReason(exit.getReason()) ||
                    now - exit.getTimestamp() > MAX_REPORT_AGE_MS
                ) {
                    continue;
                }
                String fileName = String.format(
                    "android-exit-%d-%d-%d.json",
                    exit.getTimestamp(),
                    exit.getPid(),
                    exit.getReason()
                );
                if (new File(directory, fileName).isFile()) {
                    continue;
                }
                writeReport(context, fileName, buildProcessExitReport(exit));
            }
        } catch (Throwable error) {
            android.util.Log.e(NAME, "Failed to persist Android exit diagnostics", error);
        }
    }

    private static boolean isRelevantExitReason(int reason) {
        return reason == ApplicationExitInfo.REASON_ANR ||
            reason == ApplicationExitInfo.REASON_CRASH ||
            reason == ApplicationExitInfo.REASON_CRASH_NATIVE ||
            reason == ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE ||
            reason == ApplicationExitInfo.REASON_INITIALIZATION_FAILURE ||
            reason == ApplicationExitInfo.REASON_LOW_MEMORY;
    }

    private static JSONObject buildProcessExitReport(ApplicationExitInfo exit) throws Exception {
        JSONObject report = new JSONObject();
        report.put("schemaVersion", SCHEMA_VERSION);
        report.put("source", "application-exit-info");
        report.put("platform", "android");
        report.put("capturedAt", Instant.now().toString());
        report.put("timestamp", Instant.ofEpochMilli(exit.getTimestamp()).toString());
        report.put("pid", exit.getPid());
        report.put("reason", exit.getReason());
        report.put("reasonName", processExitReasonName(exit.getReason()));
        report.put("status", exit.getStatus());
        report.put("importance", exit.getImportance());
        report.put("pssKb", exit.getPss());
        report.put("rssKb", exit.getRss());
        putString(report, "processName", exit.getProcessName());
        putString(report, "description", exit.getDescription());

        try (InputStream trace = exit.getTraceInputStream()) {
            if (trace != null) {
                report.put("traceAvailable", true);
                if (exit.getReason() == ApplicationExitInfo.REASON_ANR) {
                    String anrTrace = readLimitedText(trace, MAX_TRACE_LENGTH);
                    if (!anrTrace.isEmpty()) {
                        report.put("anrTrace", sanitizeTrace(anrTrace));
                    }
                }
            }
        }
        return report;
    }

    private static String processExitReasonName(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_ANR:
                return "anr";
            case ApplicationExitInfo.REASON_CRASH:
                return "crash";
            case ApplicationExitInfo.REASON_CRASH_NATIVE:
                return "native-crash";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:
                return "excessive-resource-usage";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:
                return "initialization-failure";
            case ApplicationExitInfo.REASON_LOW_MEMORY:
                return "low-memory";
            default:
                return "unknown";
        }
    }

    private static String readLimitedText(InputStream input, int limit) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int remaining = limit;
        while (remaining > 0) {
            int count = input.read(buffer, 0, Math.min(buffer.length, remaining));
            if (count < 0) {
                break;
            }
            output.write(buffer, 0, count);
            remaining -= count;
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private static void persistPendingNativeCrashEnvelopes(
        Context context,
        File directory,
        IEnvelopeReader envelopeReader,
        ISerializer serializer,
        int depth
    ) {
        if (!directory.isDirectory() || depth > 5) {
            return;
        }
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (file.isDirectory()) {
                persistPendingNativeCrashEnvelopes(
                    context,
                    file,
                    envelopeReader,
                    serializer,
                    depth + 1
                );
            } else if (file.getName().endsWith(".envelope")) {
                try (FileInputStream input = new FileInputStream(file)) {
                    persistCrashEvents(
                        context,
                        envelopeReader.read(input),
                        serializer
                    );
                } catch (Throwable error) {
                    android.util.Log.e(
                        NAME,
                        "Failed to read cached native crash envelope",
                        error
                    );
                }
            }
        }
    }

    private static void persistCrashEvents(
        Context context,
        SentryEnvelope envelope,
        ISerializer serializer
    ) {
        if (envelope == null) {
            return;
        }
        for (SentryEnvelopeItem item : envelope.getItems()) {
            if (item.getHeader().getType() != SentryItemType.Event) {
                continue;
            }
            try {
                SentryEvent event = item.getEvent(serializer);
                if (event != null && event.isCrashed()) {
                    persistCrashEvent(context, event);
                }
            } catch (Throwable error) {
                android.util.Log.e(
                    NAME,
                    "Failed to read native crash envelope",
                    error
                );
            }
        }
    }

    private static void persistCrashEvent(Context context, SentryEvent event) {
        try {
            JSONObject report = buildReport(event);
            String eventId = event.getEventId() == null
                ? String.valueOf(System.currentTimeMillis())
                : event.getEventId().toString();
            writeReport(
                context,
                "sentry-native-" + eventId + ".json",
                report
            );
        } catch (Throwable error) {
            android.util.Log.e(NAME, "Failed to persist native crash diagnostics", error);
        }
    }

    private static JSONObject buildReport(SentryEvent event) throws Exception {
        JSONObject report = new JSONObject();
        report.put("schemaVersion", SCHEMA_VERSION);
        report.put("source", "sentry");
        report.put("platform", "android");
        report.put("capturedAt", Instant.now().toString());
        putString(report, "eventId", event.getEventId());
        putDate(report, "timestamp", event.getTimestamp());
        putString(report, "level", event.getLevel());
        putString(report, "release", event.getRelease());
        putString(report, "dist", event.getDist());
        putString(report, "environment", event.getEnvironment());

        JSONArray exceptions = buildExceptions(event.getExceptions());
        if (exceptions.length() > 0) {
            report.put("exceptions", exceptions);
        }

        JSONArray threads = buildThreads(event.getThreads());
        if (threads.length() > 0) {
            report.put("threads", threads);
        }

        JSONArray debugImages = buildDebugImages(event.getDebugMeta());
        if (debugImages.length() > 0) {
            report.put("debugImages", debugImages);
        }
        return report;
    }

    private static JSONArray buildExceptions(List<SentryException> exceptions) throws Exception {
        JSONArray result = new JSONArray();
        if (exceptions == null) {
            return result;
        }
        for (SentryException exception : exceptions) {
            JSONObject item = new JSONObject();
            putString(item, "type", exception.getType());
            putString(item, "value", exception.getValue());
            putString(item, "module", exception.getModule());
            if (exception.getThreadId() != null) {
                item.put("threadId", exception.getThreadId());
            }
            Mechanism mechanism = exception.getMechanism();
            if (mechanism != null) {
                JSONObject mechanismJson = new JSONObject();
                putString(mechanismJson, "type", mechanism.getType());
                putString(mechanismJson, "description", mechanism.getDescription());
                if (mechanism.isHandled() != null) {
                    mechanismJson.put("handled", mechanism.isHandled());
                }
                item.put("mechanism", mechanismJson);
            }
            JSONArray frames = buildFrames(exception.getStacktrace());
            if (frames.length() > 0) {
                item.put("frames", frames);
            }
            result.put(item);
        }
        return result;
    }

    private static JSONArray buildThreads(List<SentryThread> threads) throws Exception {
        JSONArray result = new JSONArray();
        if (threads == null) {
            return result;
        }
        for (SentryThread thread : threads) {
            if (
                !Boolean.TRUE.equals(thread.isCrashed()) &&
                !Boolean.TRUE.equals(thread.isCurrent()) &&
                !Boolean.TRUE.equals(thread.isMain())
            ) {
                continue;
            }
            JSONObject item = new JSONObject();
            if (thread.getId() != null) {
                item.put("id", thread.getId());
            }
            putString(item, "name", thread.getName());
            putString(item, "state", thread.getState());
            putBoolean(item, "crashed", thread.isCrashed());
            putBoolean(item, "current", thread.isCurrent());
            putBoolean(item, "main", thread.isMain());
            JSONArray frames = buildFrames(thread.getStacktrace());
            if (frames.length() > 0) {
                item.put("frames", frames);
            }
            result.put(item);
        }
        return result;
    }

    private static JSONArray buildFrames(SentryStackTrace stackTrace) throws Exception {
        JSONArray result = new JSONArray();
        if (stackTrace == null || stackTrace.getFrames() == null) {
            return result;
        }
        List<SentryStackFrame> frames = stackTrace.getFrames();
        int start = Math.max(0, frames.size() - MAX_FRAME_COUNT);
        for (int index = start; index < frames.size(); index += 1) {
            SentryStackFrame frame = frames.get(index);
            JSONObject item = new JSONObject();
            putString(item, "function", frame.getFunction());
            putString(item, "module", frame.getModule());
            putString(item, "package", frame.getPackage());
            putString(item, "fileName", frame.getFilename());
            putString(item, "platform", frame.getPlatform());
            putString(item, "imageAddress", frame.getImageAddr());
            putString(item, "instructionAddress", frame.getInstructionAddr());
            putString(item, "symbolAddress", frame.getSymbolAddr());
            if (frame.getLineno() != null) {
                item.put("lineNumber", frame.getLineno());
            }
            if (frame.getColno() != null) {
                item.put("columnNumber", frame.getColno());
            }
            putBoolean(item, "inApp", frame.isInApp());
            putBoolean(item, "native", frame.isNative());
            result.put(item);
        }
        return result;
    }

    private static JSONArray buildDebugImages(DebugMeta debugMeta) throws Exception {
        JSONArray result = new JSONArray();
        if (debugMeta == null || debugMeta.getImages() == null) {
            return result;
        }
        for (DebugImage image : debugMeta.getImages()) {
            JSONObject item = new JSONObject();
            putString(item, "type", image.getType());
            putString(item, "uuid", image.getUuid());
            putString(item, "debugId", image.getDebugId());
            putString(item, "debugFile", image.getDebugFile());
            putString(item, "codeFile", image.getCodeFile());
            putString(item, "codeId", image.getCodeId());
            putString(item, "arch", image.getArch());
            putString(item, "imageAddress", image.getImageAddr());
            if (image.getImageSize() != null) {
                item.put("imageSize", image.getImageSize());
            }
            result.put(item);
        }
        return result;
    }

    private static void writeReport(
        Context context,
        String fileName,
        JSONObject report
    ) throws Exception {
        synchronized (FILE_LOCK) {
            File directory = new File(
                context.getCacheDir(),
                "logs/crashes"
            );
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Unable to create crash diagnostics directory");
            }

            File target = new File(directory, fileName);
            File temporary = new File(directory, fileName + ".tmp");
            byte[] payload = report.toString(2).getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream output = new FileOutputStream(temporary, false)) {
                output.write(payload);
                output.flush();
                output.getFD().sync();
            }
            if (target.exists() && !target.delete()) {
                throw new IllegalStateException("Unable to replace crash diagnostics file");
            }
            if (!temporary.renameTo(target)) {
                throw new IllegalStateException("Unable to commit crash diagnostics file");
            }
            cleanupReports(directory, System.currentTimeMillis());
        }
    }

    private static void cleanupReports(File directory, long now) {
        File[] reports = directory.listFiles(
            file -> file.isFile() && file.getName().endsWith(".json")
        );
        if (reports == null) {
            return;
        }

        List<File> retained = new ArrayList<>();
        for (File report : reports) {
            if (now - report.lastModified() > MAX_REPORT_AGE_MS) {
                if (!report.delete()) {
                    android.util.Log.w(NAME, "Unable to remove expired crash diagnostics");
                }
            } else {
                retained.add(report);
            }
        }
        retained.sort(Comparator.comparingLong(File::lastModified).reversed());
        for (int index = MAX_REPORT_COUNT; index < retained.size(); index += 1) {
            if (!retained.get(index).delete()) {
                android.util.Log.w(NAME, "Unable to rotate crash diagnostics");
            }
        }
    }

    private static void putString(JSONObject object, String key, Object value) throws Exception {
        if (value != null) {
            object.put(key, sanitize(String.valueOf(value)));
        }
    }

    private static void putDate(JSONObject object, String key, Date value) throws Exception {
        if (value != null) {
            object.put(key, value.toInstant().toString());
        }
    }

    private static void putBoolean(JSONObject object, String key, Boolean value) throws Exception {
        if (value != null) {
            object.put(key, value);
        }
    }

    private static String sanitize(String value) {
        return sanitize(value, MAX_STRING_LENGTH);
    }

    private static String sanitize(String value, int maxLength) {
        String result = value.replace('\n', ' ').replace('\r', ' ');
        return redactAndTruncate(result, maxLength);
    }

    private static String sanitizeTrace(String value) {
        String result = value.replace("\r\n", "\n").replace('\r', '\n');
        return redactAndTruncate(result, MAX_TRACE_LENGTH);
    }

    private static String redactAndTruncate(String value, int maxLength) {
        String result = value;
        for (Pattern pattern : SENSITIVE_PATTERNS) {
            result = pattern.matcher(result).replaceAll("[REDACTED]");
        }
        return result.length() > maxLength
            ? result.substring(0, maxLength) + "...(truncated)"
            : result;
    }

    private static String getString(ReadableMap map, String key, String fallback) {
        return map.hasKey(key) && !map.isNull(key) ? map.getString(key) : fallback;
    }

    private static boolean getBoolean(ReadableMap map, String key, boolean fallback) {
        return map.hasKey(key) && !map.isNull(key) ? map.getBoolean(key) : fallback;
    }

    private static int getInt(ReadableMap map, String key, int fallback) {
        return map.hasKey(key) && !map.isNull(key) ? map.getInt(key) : fallback;
    }

    private static double getDouble(ReadableMap map, String key, double fallback) {
        return map.hasKey(key) && !map.isNull(key) ? map.getDouble(key) : fallback;
    }
}
