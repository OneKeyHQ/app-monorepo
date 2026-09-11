package so.onekey.app.wallet.sentry;

import android.content.Context;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import io.sentry.JsonSerializer;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.SentryOptions.BeforeSendCallback;
import io.sentry.android.core.SentryAndroidOptions;

public final class OneKeyNativeCrashDiagnostics {
  private static final String TAG = "OneKeyCrashDiagnostics";
  private static final int MAX_REPORT_COUNT = 5;
  private static final long MAX_REPORT_AGE_MS = 7L * 24L * 60L * 60L * 1000L;
  private static final Object FILE_LOCK = new Object();
  private static final Object MNEMONIC_WORDS_LOCK = new Object();
  private static final String SENSITIVE_LABELS =
    "password|passwd|passphrase|secret|token|auth(?:entication)?|authorization|cookie|session(?:id)?|" +
    "api[-_]?key|private[-_]?key|pin[-_]?hash|backend[-_]?share|mnemonic|seed(?:[-_ ]?phrase)?|" +
    "recovery(?:[-_ ]?phrase)?|credential|email|username|phone|full[-_ ]?name|" +
    "device[-_ ]?id|installation[-_ ]?id|user[-_ ]?id|ip[-_ ]?address|client[-_ ]?ip";

  private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
    "(?i).*(?:password|passwd|passphrase|secret|token|auth|authentication|authorization|cookie|session|sessionid|apikey|privatekey|pinhash|backendshare|mnemonic|seed|recoveryphrase|credential|bearer|email|username|phone|fullname|deviceid|installationid|userid|ipaddress|clientip).*"
  );
  private static final Pattern SENSITIVE_DOUBLE_QUOTED_VALUE_PATTERN = Pattern.compile(
    "(?i)([\"']?(?:" + SENSITIVE_LABELS + ")[\"']?\\s*[:=]\\s*)\"[^\"]*\""
  );
  private static final Pattern SENSITIVE_SINGLE_QUOTED_VALUE_PATTERN = Pattern.compile(
    "(?i)([\"']?(?:" + SENSITIVE_LABELS + ")[\"']?\\s*[:=]\\s*)'[^']*'"
  );
  private static final Pattern SENSITIVE_UNQUOTED_VALUE_PATTERN = Pattern.compile(
    "(?i)([\"']?(?:" + SENSITIVE_LABELS + ")[\"']?\\s*[:=]\\s*)[^,;}\\r\\n]+"
  );
  private static final Pattern SENSITIVE_COLLECTION_VALUE_PATTERN = Pattern.compile(
    "(?i)([\"']?(?:" + SENSITIVE_LABELS + ")[\"']?\\s*[:=]\\s*)[\\[{][\\s\\S]*"
  );
  private static final Pattern AUTH_HEADER_VALUE_PATTERN = Pattern.compile(
    "(?i)(\\b(?:authorization|proxy-authorization|cookie|set-cookie)\\s*[:=]\\s*)[^\\r\\n]+"
  );
  private static final Pattern BEARER_VALUE_PATTERN = Pattern.compile(
    "(?i)(\\bbearer\\s+)[A-Za-z0-9._~+/-]+=*"
  );
  private static final Pattern BASIC_AUTH_VALUE_PATTERN = Pattern.compile(
    "(?i)(\\bbasic\\s+)[A-Za-z0-9+/]+=*"
  );
  private static final Pattern URL_PATTERN = Pattern.compile(
    "(?i)(\\b(?:https?|wss?)://)(?:[^@\\s/]+@)?([^\\s/?#]+)([^\\s?#]*)[^\\s]*"
  );
  private static final Pattern ASCII_WORD_PATTERN = Pattern.compile("[A-Za-z]+");
  private static final Pattern MNEMONIC_SEPARATOR_PATTERN = Pattern.compile(
    "[\\s,\\[\\]\\\"'\\\\]*"
  );

  private static final List<Pattern> SENSITIVE_PATTERNS = Arrays.asList(
    Pattern.compile("(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"),
    Pattern.compile("\\b0x[0-9a-fA-F]{40,64}\\b"),
    Pattern.compile("\\b(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{128})\\b"),
    Pattern.compile("\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b"),
    Pattern.compile("\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b"),
    Pattern.compile("(?i)\\b(?:[a-z0-9]{1,20}1)[a-z0-9]{20,90}\\b"),
    Pattern.compile("\\b[1-9A-HJ-NP-Za-km-z]{32,128}\\b"),
    Pattern.compile("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b"),
    Pattern.compile("(?iu)\\b(?:mnemonic|seed(?:\\s+phrase)?)\\s*[=:]\\s*(?:\\p{L}{2,16}[\\s,]+){2,}\\p{L}{2,16}\\b"),
    Pattern.compile("(?iu)(?:\\b\\p{L}{2,16}\\b[\\s,]+){11,}\\b\\p{L}{2,16}\\b")
  );
  private static final Set<String> NON_SENSITIVE_TOKEN_KEYS = new HashSet<>(
    Arrays.asList(
      "tokensymbol",
      "tokentype",
      "tokenname",
      "tokendecimals",
      "tokennetwork"
    )
  );

  private static volatile Set<String> mnemonicWords = Collections.emptySet();

  private OneKeyNativeCrashDiagnostics() {}

  public static void configure(Context context, SentryAndroidOptions options) {
    Context applicationContext = context.getApplicationContext();
    scheduleReportCleanup(applicationContext);
    BeforeSendCallback existingBeforeSend = options.getBeforeSend();
    options.setBeforeSend((event, hint) -> {
      SentryEvent preparedEvent = existingBeforeSend == null
        ? event
        : existingBeforeSend.execute(event, hint);
      if (preparedEvent != null && isNativeCrash(preparedEvent)) {
        persist(applicationContext, preparedEvent);
      }
      return preparedEvent;
    });
  }

  private static boolean isNativeCrash(SentryEvent event) {
    return event.isCrashed() && !"javascript".equalsIgnoreCase(event.getPlatform());
  }

  private static void persist(Context context, SentryEvent event) {
    try {
      initializeMnemonicWords(context);

      SentryOptions serializationOptions = new SentryOptions();
      StringWriter serializedWriter = new StringWriter();
      new JsonSerializer(serializationOptions).serialize(event, serializedWriter);
      JSONObject serializedEvent = new JSONObject(serializedWriter.toString());

      JSONObject report = new JSONObject();
      report.put("schemaVersion", 1);
      report.put("source", "sentry");
      report.put("platform", "android");
      report.put("capturedAt", Instant.now().toString());
      report.put("event", sanitizeJsonValue(serializedEvent, null));

      String eventId = event.getEventId() == null
        ? String.valueOf(System.currentTimeMillis())
        : event.getEventId().toString();
      long eventTimeMs = event.getTimestamp() == null
        ? System.currentTimeMillis()
        : event.getTimestamp().getTime();
      writeReport(
        context,
        "sentry-native-" + eventId + ".json",
        report,
        eventTimeMs
      );
    } catch (Throwable error) {
      Log.e(TAG, "Failed to persist native crash diagnostics", error);
    }
  }

  private static Object sanitizeJsonValue(Object value, String containerKey) throws Exception {
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
      Set<Integer> mnemonicWordIndexes = findMnemonicWordIndexes(source);
      for (int index = 0; index < source.length(); index += 1) {
        result.put(
          mnemonicWordIndexes.contains(index)
            ? "[REDACTED]"
            : sanitizeJsonValue(source.get(index), containerKey)
        );
      }
      return result;
    }
    if (value instanceof JSONObject) {
      JSONObject source = (JSONObject) value;
      JSONObject result = new JSONObject();
      Iterator<String> keys = source.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        if (containerKey == null && isOmittedTopLevelKey(key)) {
          continue;
        }
        Object child = source.get(key);
        Object sanitizedChild;
        if (isSensitiveKey(key) || isSensitiveChildKey(containerKey, key)) {
          sanitizedChild = "[REDACTED]";
        } else if (
          child instanceof String && isValidTechnicalIdentifier(key, (String) child)
        ) {
          sanitizedChild = child;
        } else {
          sanitizedChild = sanitizeJsonValue(child, key);
        }
        result.put(redact(key), sanitizedChild);
      }
      return result;
    }
    return redact(String.valueOf(value));
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
          return sanitizeJsonValue(parsed, null).toString();
        }
      } catch (Exception error) {
        // Fall through to text sanitization for non-JSON diagnostic strings.
      }
    }
    return redact(value);
  }

  private static boolean isSensitiveKey(String key) {
    String normalized = normalizeKey(key);
    if (NON_SENSITIVE_TOKEN_KEYS.contains(normalized)) {
      return false;
    }
    return SENSITIVE_KEY_PATTERN.matcher(normalized).matches();
  }

  private static boolean isSensitiveChildKey(String containerKey, String key) {
    if (containerKey == null) {
      return false;
    }
    String normalizedContainer = normalizeKey(containerKey);
    String normalizedKey = normalizeKey(key);
    if ("user".equals(normalizedContainer)) {
      return Arrays.asList("id", "name", "segment").contains(normalizedKey);
    }
    if ("device".equals(normalizedContainer)) {
      return Arrays.asList("id", "name").contains(normalizedKey);
    }
    return false;
  }

  private static boolean isOmittedTopLevelKey(String key) {
    String normalized = normalizeKey(key);
    return "user".equals(normalized) || "request".equals(normalized);
  }

  private static boolean isValidTechnicalIdentifier(String key, String value) {
    String normalizedKey = normalizeKey(key);
    if ("eventid".equals(normalizedKey) || "traceid".equals(normalizedKey)) {
      return value.matches("(?i)[0-9a-f]{32}");
    }
    if ("spanid".equals(normalizedKey) || "parentspanid".equals(normalizedKey)) {
      return value.matches("(?i)[0-9a-f]{16}");
    }
    if ("debugid".equals(normalizedKey)) {
      return value.matches(
        "(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
      );
    }
    if ("codeid".equals(normalizedKey)) {
      return value.matches("(?i)[0-9a-f]{8,64}");
    }
    if (
      "imageaddr".equals(normalizedKey) ||
      "instructionaddr".equals(normalizedKey) ||
      "symboladdr".equals(normalizedKey)
    ) {
      return value.matches("(?i)(?:0x)?[0-9a-f]{1,16}");
    }
    return false;
  }

  private static String normalizeKey(String key) {
    return key.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
  }

  private static String redact(String value) {
    String result = redactMnemonicSequences(value);
    result = AUTH_HEADER_VALUE_PATTERN.matcher(result).replaceAll("$1[REDACTED]");
    result = BEARER_VALUE_PATTERN.matcher(result).replaceAll("$1[REDACTED]");
    result = BASIC_AUTH_VALUE_PATTERN.matcher(result).replaceAll("$1[REDACTED]");
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
    result = URL_PATTERN.matcher(result).replaceAll("$1$2$3");
    for (Pattern pattern : SENSITIVE_PATTERNS) {
      result = pattern.matcher(result).replaceAll("[REDACTED]");
    }
    return result;
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
        Log.e(TAG, "Failed to load sensitive word filter", error);
      }
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

  private static Set<Integer> findMnemonicWordIndexes(JSONArray source)
    throws Exception {
    if (mnemonicWords.isEmpty()) {
      return Collections.emptySet();
    }
    Set<Integer> sensitiveIndexes = new HashSet<>();
    List<Integer> sequence = new ArrayList<>();
    for (int index = 0; index < source.length(); index += 1) {
      Object item = source.get(index);
      boolean isMnemonicWord = item instanceof String && mnemonicWords.contains(
        ((String) item).trim().toLowerCase(Locale.ROOT)
      );
      if (!isMnemonicWord) {
        retainSensitiveIndexes(sequence, sensitiveIndexes);
        sequence.clear();
      } else {
        sequence.add(index);
      }
    }
    retainSensitiveIndexes(sequence, sensitiveIndexes);
    return sensitiveIndexes;
  }

  private static void retainSensitiveIndexes(
    List<Integer> sequence,
    Set<Integer> sensitiveIndexes
  ) {
    if (sequence.size() >= 3) {
      sensitiveIndexes.addAll(sequence);
    }
  }

  private static void retainSensitiveSequence(
    List<int[]> sequence,
    List<int[]> sensitiveRanges
  ) {
    if (sequence.size() >= 3) {
      sensitiveRanges.addAll(sequence);
    }
  }

  private static void writeReport(
    Context context,
    String fileName,
    JSONObject report,
    long eventTimeMs
  ) throws Exception {
    synchronized (FILE_LOCK) {
      File directory = new File(context.getCacheDir(), "logs/crashes");
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
      try {
        Files.move(
          temporary.toPath(),
          target.toPath(),
          StandardCopyOption.ATOMIC_MOVE,
          StandardCopyOption.REPLACE_EXISTING
        );
      } catch (AtomicMoveNotSupportedException error) {
        Files.move(
          temporary.toPath(),
          target.toPath(),
          StandardCopyOption.REPLACE_EXISTING
        );
      }
      if (eventTimeMs > 0L && !target.setLastModified(eventTimeMs)) {
        Log.w(TAG, "Unable to preserve native crash timestamp");
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
          Log.w(TAG, "Unable to remove stale crash diagnostic temporary file");
        }
      }
    }

    File[] reports = directory.listFiles(
      file -> file.isFile() &&
        file.getName().startsWith("sentry-native-") &&
        file.getName().endsWith(".json")
    );
    if (reports == null) {
      return;
    }
    List<File> retained = new ArrayList<>();
    for (File report : reports) {
      if (now - report.lastModified() > MAX_REPORT_AGE_MS) {
        if (!report.delete()) {
          Log.w(TAG, "Unable to remove expired native crash diagnostic");
        }
      } else {
        retained.add(report);
      }
    }
    retained.sort(Comparator.comparingLong(File::lastModified).reversed());
    for (int index = MAX_REPORT_COUNT; index < retained.size(); index += 1) {
      if (!retained.get(index).delete()) {
        Log.w(TAG, "Unable to rotate native crash diagnostics");
      }
    }
  }

  private static void scheduleReportCleanup(Context context) {
    Thread cleanupThread = new Thread(() -> {
      synchronized (FILE_LOCK) {
        File directory = new File(context.getCacheDir(), "logs/crashes");
        if (directory.isDirectory()) {
          cleanupReports(directory, System.currentTimeMillis());
        }
      }
    }, "onekey-crash-log-cleanup");
    cleanupThread.setPriority(Thread.MIN_PRIORITY);
    cleanupThread.start();
  }
}
