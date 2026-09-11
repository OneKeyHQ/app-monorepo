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
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

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
import io.sentry.protocol.App;
import io.sentry.protocol.Contexts;
import io.sentry.protocol.Device;
import io.sentry.protocol.Gpu;
import io.sentry.protocol.Mechanism;
import io.sentry.protocol.OperatingSystem;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryRuntime;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;
import io.sentry.protocol.SentryThread;
import io.sentry.react.RNSentrySDK;

@ReactModule(name = OneKeySentryCrashDiagnosticsModule.NAME)
public final class OneKeySentryCrashDiagnosticsModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OneKeySentryCrashDiagnostics";

    private static final int SCHEMA_VERSION = 1;
    private static final int MAX_REPORT_COUNT = 5;
    private static final int MAX_TRANSPORT_EXCEPTION_COUNT = 8;
    private static final int MAX_TRANSPORT_THREAD_COUNT = 16;
    private static final int MAX_TRANSPORT_DEBUG_IMAGE_COUNT = 256;
    private static final int MAX_TRANSPORT_FRAME_COUNT = 128;
    private static final int MAX_PROCESS_EXIT_COUNT = 10;
    private static final int MAX_CACHED_ENVELOPE_COUNT = 60;
    private static final long MAX_REPORT_AGE_MS = 7L * 24L * 60L * 60L * 1000L;
    private static final Object INITIALIZATION_LOCK = new Object();
    private static final Object FILE_LOCK = new Object();
    private static final Object MNEMONIC_WORDS_LOCK = new Object();
    private static final AtomicBoolean HISTORICAL_COLLECTION_STARTED = new AtomicBoolean();
    private static final ExecutorService DIAGNOSTICS_EXECUTOR =
        Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "OneKeyCrashDiagnostics");
            thread.setDaemon(true);
            return thread;
        });
    private static final Set<String> SAFE_CONTEXT_KEYS = new HashSet<>(
        Arrays.asList("app", "device", "os", "runtime", "gpu")
    );
    private static boolean initialized;
    private static volatile Set<String> mnemonicWords = Collections.emptySet();

    private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
        "(?i).*(?:password|passwd|passphrase|secret|token|authorization|cookie|sessionid|apikey|privatekey|mnemonic|seed|recoveryphrase|credential|bearer).*"
    );
    private static final Pattern SENSITIVE_DOUBLE_QUOTED_VALUE_PATTERN = Pattern.compile(
        "(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)\"[^\"]*\""
    );
    private static final Pattern SENSITIVE_SINGLE_QUOTED_VALUE_PATTERN = Pattern.compile(
        "(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)'[^']*'"
    );
    private static final Pattern SENSITIVE_UNQUOTED_VALUE_PATTERN = Pattern.compile(
        "(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)[^\"'\\s,;}]+"
    );
    private static final Pattern SENSITIVE_COLLECTION_VALUE_PATTERN = Pattern.compile(
        "(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)[\\[{][\\s\\S]*"
    );
    private static final Pattern BEARER_VALUE_PATTERN = Pattern.compile(
        "(?i)(\\bbearer\\s+)[A-Za-z0-9._~+/-]+=*"
    );
    private static final Pattern ASCII_WORD_PATTERN = Pattern.compile("[A-Za-z]+");
    private static final Pattern MNEMONIC_SEPARATOR_PATTERN = Pattern.compile("[\\s,]*");

    private static final List<Pattern> SENSITIVE_PATTERNS = Arrays.asList(
        Pattern.compile("(?i)\\b(?:https?|wss?)://[^\\s]+"),
        Pattern.compile("(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"),
        Pattern.compile("\\b0x[0-9a-fA-F]{40,64}\\b"),
        Pattern.compile("\\b[0-9a-fA-F]{64}\\b"),
        Pattern.compile("\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b"),
        Pattern.compile("\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b"),
        Pattern.compile("(?i)\\b(?:[a-z0-9]{1,20}1)[a-z0-9]{20,90}\\b"),
        Pattern.compile("\\b[1-9A-HJ-NP-Za-km-z]{32,128}\\b"),
        Pattern.compile("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b"),
        Pattern.compile("(?iu)\\b(?:mnemonic|seed(?:\\s+phrase)?)\\s*[=:]\\s*(?:\\p{L}{2,16}[\\s,]+){2,}\\p{L}{2,16}\\b"),
        Pattern.compile("(?iu)(?:\\b\\p{L}{2,16}\\b[\\s,]+){11,}\\b\\p{L}{2,16}\\b")
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
        return initializeNativeSentry(
            getReactApplicationContext(),
            getString(configuration, "dsn", "")
        );
    }

    public static boolean initializeNativeSentry(Context context, String dsn) {
        initializeMnemonicWords(context.getApplicationContext());
        synchronized (INITIALIZATION_LOCK) {
            if (initialized || Sentry.isEnabled()) {
                initialized = true;
                return true;
            }

            if (dsn.isEmpty()) {
                return false;
            }

            try {
                RNSentrySDK.init(
                    context.getApplicationContext(),
                    options -> configureOptions(
                        options,
                        context.getApplicationContext(),
                        dsn
                    )
                );
                initialized = Sentry.isEnabled();
                return initialized;
            } catch (Throwable error) {
                android.util.Log.e(NAME, "Failed to initialize native Sentry diagnostics", error);
                return false;
            }
        }
    }

    private static void configureOptions(
        SentryAndroidOptions options,
        Context context,
        String dsn
    ) {
        options.setDsn(dsn);
        options.setEnabled(true);
        options.setMaxBreadcrumbs(100);
        options.setMaxCacheItems(60);
        options.setAnrEnabled(true);
        options.setAnrTimeoutIntervalMillis(5000L);
        options.setEnableNdk(true);
        options.setAttachScreenshot(false);
        options.setAttachViewHierarchy(false);
        options.setSendDefaultPii(false);

        BeforeSendCallback existingBeforeSend = options.getBeforeSend();
        options.setBeforeSend((event, hint) -> {
            SentryEvent preparedEvent = existingBeforeSend == null
                ? event
                : existingBeforeSend.execute(event, hint);
            if (preparedEvent != null && preparedEvent.isCrashed()) {
                persistCrashEvent(context, preparedEvent, true);
            }
            if (preparedEvent != null) {
                sanitizeEventForTransport(preparedEvent);
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
                context,
                envelope,
                options.getSerializer(),
                false
            );
        });
    }

    public static void collectHistoricalDiagnosticsAsync(Context context) {
        if (!HISTORICAL_COLLECTION_STARTED.compareAndSet(false, true)) {
            return;
        }
        Context applicationContext = context.getApplicationContext();
        DIAGNOSTICS_EXECUTOR.execute(() -> {
            persistHistoricalProcessExitDiagnostics(applicationContext);
            persistPendingNativeCrashEnvelopes(applicationContext);
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
            0,
            new int[] { 0 }
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
                writeReport(
                    context,
                    fileName,
                    buildProcessExitReport(exit),
                    exit.getTimestamp(),
                    false
                );
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
                    String anrTrace = readText(trace);
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

    private static String readText(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        while (true) {
            int count = input.read(buffer);
            if (count < 0) {
                break;
            }
            output.write(buffer, 0, count);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private static void persistPendingNativeCrashEnvelopes(
        Context context,
        File directory,
        IEnvelopeReader envelopeReader,
        ISerializer serializer,
        int depth,
        int[] visitedEnvelopeCount
    ) {
        if (!directory.isDirectory() || depth > 5) {
            return;
        }
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (visitedEnvelopeCount[0] >= MAX_CACHED_ENVELOPE_COUNT) {
                return;
            }
            if (file.isDirectory()) {
                persistPendingNativeCrashEnvelopes(
                    context,
                    file,
                    envelopeReader,
                    serializer,
                    depth + 1,
                    visitedEnvelopeCount
                );
            } else if (file.getName().endsWith(".envelope")) {
                visitedEnvelopeCount[0] += 1;
                try (FileInputStream input = new FileInputStream(file)) {
                    persistCrashEvents(
                        context,
                        envelopeReader.read(input),
                        serializer,
                        false
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
        ISerializer serializer,
        boolean replaceExisting
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
                    persistCrashEvent(context, event, replaceExisting);
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

    private static void persistCrashEvent(
        Context context,
        SentryEvent event,
        boolean replaceExisting
    ) {
        try {
            JSONObject report = buildReport(event);
            String eventId = event.getEventId() == null
                ? String.valueOf(System.currentTimeMillis())
                : event.getEventId().toString();
            String reportPrefix = "javascript".equalsIgnoreCase(event.getPlatform())
                ? "sentry-js-"
                : "sentry-native-";
            writeReport(
                context,
                reportPrefix + eventId + ".json",
                report,
                event.getTimestamp() == null
                    ? System.currentTimeMillis()
                    : event.getTimestamp().getTime(),
                replaceExisting
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

        SentryOptions serializationOptions = new SentryOptions();
        StringWriter serializedWriter = new StringWriter();
        new JsonSerializer(serializationOptions).serialize(event, serializedWriter);
        JSONObject serializedEvent = new JSONObject(serializedWriter.toString());
        serializedEvent.remove("user");
        serializedEvent.remove("request");
        report.put("event", sanitizeJsonValue(serializedEvent));
        return report;
    }

    private static Object sanitizeJsonValue(Object value) throws Exception {
        if (value == null || value == JSONObject.NULL) {
            return JSONObject.NULL;
        }
        if (value instanceof String) {
            return sanitizeStringValue((String) value);
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value;
        }
        if (value instanceof JSONArray) {
            JSONArray source = (JSONArray) value;
            JSONArray result = new JSONArray();
            for (int index = 0; index < source.length(); index += 1) {
                result.put(sanitizeJsonValue(source.get(index)));
            }
            return result;
        }
        if (value instanceof JSONObject) {
            JSONObject source = (JSONObject) value;
            JSONObject result = new JSONObject();
            Iterator<String> keys = source.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                result.put(
                    redact(key),
                    isSensitiveKey(key)
                        ? "[REDACTED]"
                        : sanitizeJsonValue(source.get(key))
                );
            }
            return result;
        }
        return redact(String.valueOf(value));
    }

    private static void sanitizeEventForTransport(SentryEvent event) {
        event.setUser(null);
        event.setRequest(null);
        event.setBreadcrumbs(null);
        event.setExtras(null);
        event.setTags(null);
        event.setServerName(null);
        event.setMessage(null);
        event.setLogger(null);
        event.setTransaction(null);
        event.setFingerprints(null);
        event.setModules(null);
        event.setUnknown(null);

        List<SentryException> exceptions = event.getExceptions();
        if (exceptions != null) {
            int start = Math.max(0, exceptions.size() - MAX_TRANSPORT_EXCEPTION_COUNT);
            List<SentryException> retained = new ArrayList<>();
            for (int index = start; index < exceptions.size(); index += 1) {
                SentryException exception = exceptions.get(index);
                exception.setValue(null);
                exception.setUnknown(null);
                Mechanism mechanism = exception.getMechanism();
                if (mechanism != null) {
                    mechanism.setDescription(null);
                    mechanism.setHelpLink(null);
                    mechanism.setData(null);
                    mechanism.setUnknown(null);
                }
                sanitizeStackTrace(exception.getStacktrace());
                retained.add(exception);
            }
            event.setExceptions(retained);
        }

        List<SentryThread> threads = event.getThreads();
        if (threads != null) {
            List<SentryThread> retained = new ArrayList<>();
            for (SentryThread thread : threads) {
                sanitizeThread(thread);
                if (
                    Boolean.TRUE.equals(thread.isCrashed()) ||
                    Boolean.TRUE.equals(thread.isCurrent()) ||
                    Boolean.TRUE.equals(thread.isMain())
                ) {
                    retained.add(thread);
                    if (retained.size() >= MAX_TRANSPORT_THREAD_COUNT) {
                        break;
                    }
                }
            }
            if (retained.size() < MAX_TRANSPORT_THREAD_COUNT) {
                for (SentryThread thread : threads) {
                    if (!retained.contains(thread)) {
                        retained.add(thread);
                        if (retained.size() >= MAX_TRANSPORT_THREAD_COUNT) {
                            break;
                        }
                    }
                }
            }
            event.setThreads(retained);
        }

        DebugMeta debugMeta = event.getDebugMeta();
        if (debugMeta != null) {
            debugMeta.setUnknown(null);
            List<DebugImage> images = debugMeta.getImages();
            if (images != null) {
                List<DebugImage> retained = new ArrayList<>();
                int count = Math.min(images.size(), MAX_TRANSPORT_DEBUG_IMAGE_COUNT);
                for (int index = 0; index < count; index += 1) {
                    DebugImage image = images.get(index);
                    image.setDebugFile(fileNameOnly(image.getDebugFile()));
                    image.setCodeFile(fileNameOnly(image.getCodeFile()));
                    image.setUnknown(null);
                    retained.add(image);
                }
                debugMeta.setImages(retained);
            }
        }

        sanitizeContexts(event.getContexts());
    }

    private static void sanitizeThread(SentryThread thread) {
        thread.setName(null);
        thread.setHeldLocks(null);
        thread.setUnknown(null);
        sanitizeStackTrace(thread.getStacktrace());
    }

    private static void sanitizeStackTrace(SentryStackTrace stackTrace) {
        if (stackTrace == null) {
            return;
        }
        stackTrace.setRegisters(null);
        stackTrace.setUnknown(null);
        List<SentryStackFrame> frames = stackTrace.getFrames();
        if (frames == null) {
            return;
        }
        int start = Math.max(0, frames.size() - MAX_TRANSPORT_FRAME_COUNT);
        List<SentryStackFrame> retained = new ArrayList<>();
        for (int index = start; index < frames.size(); index += 1) {
            SentryStackFrame frame = frames.get(index);
            frame.setFilename(fileNameOnly(frame.getFilename()));
            frame.setAbsPath(null);
            frame.setContextLine(null);
            frame.setPreContext(null);
            frame.setPostContext(null);
            frame.setVars(null);
            frame.setLock(null);
            frame.setUnknown(null);
            retained.add(frame);
        }
        stackTrace.setFrames(retained);
    }

    private static void sanitizeContexts(Contexts contexts) {
        List<String> unsafeKeys = new ArrayList<>();
        for (java.util.Map.Entry<String, Object> entry : contexts.entrySet()) {
            if (!SAFE_CONTEXT_KEYS.contains(entry.getKey())) {
                unsafeKeys.add(entry.getKey());
            }
        }
        for (String key : unsafeKeys) {
            contexts.remove(key);
        }

        App app = contexts.getApp();
        if (app != null) {
            app.setDeviceAppHash(null);
            app.setPermissions(null);
            app.setViewNames(null);
            app.setUnknown(null);
        }
        Device device = contexts.getDevice();
        if (device != null) {
            device.setName(null);
            device.setId(null);
            device.setLocale(null);
            device.setTimezone(null);
            device.setUnknown(null);
        }
        OperatingSystem operatingSystem = contexts.getOperatingSystem();
        if (operatingSystem != null) {
            operatingSystem.setRawDescription(null);
            operatingSystem.setUnknown(null);
        }
        SentryRuntime runtime = contexts.getRuntime();
        if (runtime != null) {
            runtime.setRawDescription(null);
            runtime.setUnknown(null);
        }
        Gpu gpu = contexts.getGpu();
        if (gpu != null) {
            gpu.setUnknown(null);
        }
    }

    private static void writeReport(
        Context context,
        String fileName,
        JSONObject report,
        long eventTimeMs,
        boolean replaceExisting
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
            if (target.exists() && !replaceExisting) {
                return;
            }
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
            if (eventTimeMs > 0L && !target.setLastModified(eventTimeMs)) {
                android.util.Log.w(NAME, "Unable to preserve crash diagnostics timestamp");
            }
            cleanupReports(directory, System.currentTimeMillis());
        }
    }

    private static void cleanupReports(File directory, long now) {
        File[] temporaryFiles = directory.listFiles(
            file -> file.isFile() && file.getName().endsWith(".tmp")
        );
        if (temporaryFiles != null) {
            for (File temporaryFile : temporaryFiles) {
                if (!temporaryFile.delete()) {
                    android.util.Log.w(NAME, "Unable to remove temporary crash diagnostics");
                }
            }
        }
        File[] reports = directory.listFiles(
            file -> file.isFile() && file.getName().endsWith(".json")
        );
        if (reports == null) {
            return;
        }

        List<File> nativeReports = new ArrayList<>();
        List<File> javascriptReports = new ArrayList<>();
        for (File report : reports) {
            if (now - report.lastModified() > MAX_REPORT_AGE_MS) {
                if (!report.delete()) {
                    android.util.Log.w(NAME, "Unable to remove expired crash diagnostics");
                }
            } else {
                if (report.getName().startsWith("sentry-js-")) {
                    javascriptReports.add(report);
                } else {
                    nativeReports.add(report);
                }
            }
        }
        rotateReports(nativeReports);
        rotateReports(javascriptReports);
    }

    private static void rotateReports(List<File> retained) {
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

    private static String sanitize(String value) {
        return redact(value.replace('\n', ' ').replace('\r', ' '));
    }

    private static String sanitizeTrace(String value) {
        String normalized = value.replace("\r\n", "\n").replace('\r', '\n');
        return redact(normalized);
    }

    private static String fileNameOnly(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        return new File(value).getName();
    }

    private static String redact(String value) {
        String result = redactMnemonicSequences(value);
        result = BEARER_VALUE_PATTERN
            .matcher(result)
            .replaceAll("$1[REDACTED]");
        result = SENSITIVE_COLLECTION_VALUE_PATTERN
            .matcher(result)
            .replaceAll("$1[REDACTED]");
        result = SENSITIVE_DOUBLE_QUOTED_VALUE_PATTERN
            .matcher(result)
            .replaceAll("$1\"[REDACTED]\"");
        result = SENSITIVE_SINGLE_QUOTED_VALUE_PATTERN
            .matcher(result)
            .replaceAll("$1'[REDACTED]'");
        result = SENSITIVE_UNQUOTED_VALUE_PATTERN
            .matcher(result)
            .replaceAll("$1[REDACTED]");
        for (Pattern pattern : SENSITIVE_PATTERNS) {
            result = pattern.matcher(result).replaceAll("[REDACTED]");
        }
        return result;
    }

    private static String sanitizeStringValue(String value) throws Exception {
        String trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                JSONTokener tokenizer = new JSONTokener(trimmed);
                Object parsed = tokenizer.nextValue();
                if (
                    (parsed instanceof JSONObject || parsed instanceof JSONArray) &&
                    tokenizer.nextClean() == 0
                ) {
                    return sanitizeJsonValue(parsed).toString();
                }
            } catch (Exception error) {
                // Fall back to text sanitization for non-JSON diagnostic strings.
            }
        }
        return redact(value);
    }

    private static boolean isSensitiveKey(String key) {
        String normalized = key
            .replaceAll("[^A-Za-z0-9]", "")
            .toLowerCase(Locale.ROOT);
        return SENSITIVE_KEY_PATTERN.matcher(normalized).matches();
    }

    private static void initializeMnemonicWords(Context context) {
        if (!mnemonicWords.isEmpty()) {
            return;
        }
        synchronized (MNEMONIC_WORDS_LOCK) {
            if (!mnemonicWords.isEmpty()) {
                return;
            }
            try (InputStream input = context.getAssets().open("onekey-bip39-english.json")) {
                JSONArray source = new JSONArray(readText(input));
                Set<String> loadedWords = new HashSet<>();
                for (int index = 0; index < source.length(); index += 1) {
                    loadedWords.add(source.getString(index).toLowerCase(Locale.ROOT));
                }
                mnemonicWords = Collections.unmodifiableSet(loadedWords);
            } catch (Throwable error) {
                android.util.Log.e(NAME, "Failed to load sensitive word filter");
            }
        }
    }

    private static String redactMnemonicSequences(String value) {
        if (mnemonicWords.isEmpty()) {
            return value;
        }
        Matcher matcher = ASCII_WORD_PATTERN.matcher(value);
        List<int[]> sequence = new ArrayList<>();
        List<int[]> sensitiveRanges = new ArrayList<>();
        int previousEnd = -1;
        while (matcher.find()) {
            boolean followsSequence = previousEnd < 0 || MNEMONIC_SEPARATOR_PATTERN
                .matcher(value.substring(previousEnd, matcher.start()))
                .matches();
            boolean isMnemonicWord = mnemonicWords.contains(
                matcher.group().toLowerCase(Locale.ROOT)
            );
            if (!followsSequence || !isMnemonicWord) {
                retainSensitiveSequence(sequence, sensitiveRanges);
                sequence.clear();
            }
            if (isMnemonicWord) {
                sequence.add(new int[] { matcher.start(), matcher.end() });
            }
            previousEnd = matcher.end();
        }
        retainSensitiveSequence(sequence, sensitiveRanges);
        if (sensitiveRanges.isEmpty()) {
            return value;
        }
        StringBuilder result = new StringBuilder(value);
        for (int index = sensitiveRanges.size() - 1; index >= 0; index -= 1) {
            int[] range = sensitiveRanges.get(index);
            result.replace(range[0], range[1], "[REDACTED]");
        }
        return result.toString();
    }

    private static void retainSensitiveSequence(
        List<int[]> sequence,
        List<int[]> sensitiveRanges
    ) {
        if (sequence.size() >= 3) {
            sensitiveRanges.addAll(sequence);
        }
    }

    private static String getString(ReadableMap map, String key, String fallback) {
        return map.hasKey(key) && !map.isNull(key) ? map.getString(key) : fallback;
    }

}
