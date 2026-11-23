package so.onekey.app.wallet.marketwidget;

import android.os.Process;

import com.margelo.nitro.nativelogger.OneKeyLog;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Local, release-enabled diagnostics. Never pass URLs, assets, payloads, or session tokens. */
final class MarketWidgetLog {
    static final ThreadLocal<String> refreshId = new ThreadLocal<>();

    static void initialize(android.content.Context context) {
        OneKeyLog.init(context.getApplicationContext());
    }
    static String sessionRef(String token) {
        if (token == null) return "none";
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (int index = 0; index < 8; index++) {
                result.append(Character.forDigit((digest[index] & 0xff) >> 4, 16));
                result.append(Character.forDigit(digest[index] & 0x0f, 16));
            }
            return result.toString();
        } catch (Exception ignored) { return "unavailable"; }
    }

    static void event(String event, Object... fields) {
        write(event, null, fields);
    }

    static void failure(String event, Throwable error, Object... fields) {
        write(event, error, fields);
    }

    private static void write(String event, Throwable error, Object... fields) {
        try {
            JSONObject value = new JSONObject().put("event", event).put("pid", Process.myPid());
            if (refreshId.get() != null) value.put("refreshId", refreshId.get());
            for (int index = 0; index + 1 < fields.length; index += 2) {
                Object field = fields[index + 1];
                if (field instanceof String || field instanceof Number || field instanceof Boolean) {
                    value.put((String) fields[index], field);
                }
            }
            if (error != null) {
                // Exception messages can include HTTP bodies, paths, or serialized settings.
                value.put("errorClass", error.getClass().getSimpleName());
                if (error.getCause() != null) value.put("causeClass", error.getCause().getClass().getSimpleName());
                StackTraceElement[] stack = error.getStackTrace();
                if (stack.length > 0) value.put("origin", stack[0].getClassName() + "." + stack[0].getMethodName() + ":" + stack[0].getLineNumber());
                OneKeyLog.warn("MarketWidget", value.toString());
            } else {
                OneKeyLog.info("MarketWidget", value.toString());
            }
        } catch (Exception ignored) {
            // Diagnostics must never alter widget or launcher behavior.
        }
    }
}
