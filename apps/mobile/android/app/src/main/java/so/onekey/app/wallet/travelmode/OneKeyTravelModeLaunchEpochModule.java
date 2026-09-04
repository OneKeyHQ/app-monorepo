package so.onekey.app.wallet.travelmode;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.tencent.mmkv.MMKV;

import java.util.Arrays;
import java.util.List;

import org.json.JSONObject;

@ReactModule(name = OneKeyTravelModeLaunchEpochModule.NAME)
public final class OneKeyTravelModeLaunchEpochModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OneKeyTravelModeLaunchEpoch";

    private static final String TRAVEL_MODE_MMKV_ID = "onekey-app-setting";
    private static final String TRAVEL_MODE_CONTROL_KEY = "onekey_travel_mode_control_v1";
    private static final String PREFERENCES_NAME = "onekey_travel_mode_launch_epoch";
    private static final String EPOCH_KEY = "epoch";
    private static final String PENDING_EPOCH_KEY = "pending_epoch";
    private static final String PENDING_PROFILE_KEY = "pending_profile";
    private static final String PENDING_DEADLINE_KEY = "pending_deadline";
    private static final String MAIN_ACK_EPOCH_KEY = "main_ack_epoch";
    private static final String BACKGROUND_ACK_EPOCH_KEY = "background_ack_epoch";
    private static final String COMPLETED_EPOCH_KEY = "completed_epoch";
    private static final long ACKNOWLEDGEMENT_TIMEOUT_MS = 10_000L;
    private static final Object LOCK = new Object();
    private static final List<String> VALID_PROFILES = Arrays.asList(
        "standard",
        "travel-mode"
    );
    private static final List<String> VALID_RUNTIMES = Arrays.asList(
        "main",
        "background"
    );

    public OneKeyTravelModeLaunchEpochModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void prepareRestart(String profile, Promise promise) {
        synchronized (LOCK) {
            try {
                requireSupported(VALID_PROFILES.contains(profile), "Unsupported profile");
                SharedPreferences preferences = getPreferences();
                long epoch = preferences.getLong(EPOCH_KEY, 0L) + 1L;
                long deadlineAt = System.currentTimeMillis() + ACKNOWLEDGEMENT_TIMEOUT_MS;
                boolean committed = preferences.edit()
                    .putLong(EPOCH_KEY, epoch)
                    .putLong(PENDING_EPOCH_KEY, epoch)
                    .putString(PENDING_PROFILE_KEY, profile)
                    .putLong(PENDING_DEADLINE_KEY, deadlineAt)
                    .remove(MAIN_ACK_EPOCH_KEY)
                    .remove(BACKGROUND_ACK_EPOCH_KEY)
                    .commit();
                if (!committed) {
                    throw new IllegalStateException("Launch epoch commit failed");
                }
                promise.resolve((double) epoch);
            } catch (Exception error) {
                promise.reject("TRAVEL_MODE_LAUNCH_PREPARE_FAILED", error.getMessage(), error);
            }
        }
    }

    @ReactMethod
    public void forceDisableForRecovery(Promise promise) {
        try {
            forceDisableTravelModeForRecovery(getReactApplicationContext());
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("TRAVEL_MODE_RECOVERY_FAILED", error.getMessage(), error);
        }
    }

    public static void forceDisableTravelModeForRecovery(Context context) {
        synchronized (LOCK) {
            MMKV.initialize(context);
            MMKV mmkv = MMKV.mmkvWithID(TRAVEL_MODE_MMKV_ID);
            if (mmkv == null) {
                throw new IllegalStateException("Travel Mode MMKV is unavailable");
            }
            String rawValue = mmkv.decodeString(TRAVEL_MODE_CONTROL_KEY);
            if (rawValue != null && !rawValue.isEmpty()) {
                JSONObject record = null;
                try {
                    record = new JSONObject(rawValue);
                } catch (Exception ignored) {
                    // An invalid control record is fail-closed during normal startup,
                    // but the explicit recovery path resets it to the standard profile.
                }
                if (record != null && isValidControlRecord(record)) {
                    try {
                        record.put("enabled", false);
                    } catch (Exception error) {
                        throw new IllegalStateException("Travel Mode control update failed", error);
                    }
                    if (!mmkv.encode(TRAVEL_MODE_CONTROL_KEY, record.toString())) {
                        throw new IllegalStateException("Travel Mode control commit failed");
                    }
                } else {
                    mmkv.removeValueForKey(TRAVEL_MODE_CONTROL_KEY);
                }
            }
            mmkv.sync();
            String persistedValue = mmkv.decodeString(TRAVEL_MODE_CONTROL_KEY);
            if (persistedValue != null && !persistedValue.isEmpty()) {
                try {
                    JSONObject persistedRecord = new JSONObject(persistedValue);
                    if (!isValidControlRecord(persistedRecord) ||
                        persistedRecord.getBoolean("enabled")) {
                        throw new IllegalStateException("Travel Mode control verification failed");
                    }
                } catch (IllegalStateException error) {
                    throw error;
                } catch (Exception error) {
                    throw new IllegalStateException("Travel Mode control verification failed", error);
                }
            }

            SharedPreferences preferences = context.getSharedPreferences(
                PREFERENCES_NAME,
                Context.MODE_PRIVATE
            );
            boolean committed = preferences.edit()
                .remove(PENDING_EPOCH_KEY)
                .remove(PENDING_PROFILE_KEY)
                .remove(PENDING_DEADLINE_KEY)
                .remove(MAIN_ACK_EPOCH_KEY)
                .remove(BACKGROUND_ACK_EPOCH_KEY)
                .commit();
            if (!committed || preferences.contains(PENDING_EPOCH_KEY)) {
                throw new IllegalStateException("Launch recovery commit failed");
            }
        }
    }

    @ReactMethod
    public void acknowledgeRuntimeLaunch(String runtime, String profile, Promise promise) {
        synchronized (LOCK) {
            try {
                requireSupported(VALID_RUNTIMES.contains(runtime), "Unsupported runtime");
                requireSupported(VALID_PROFILES.contains(profile), "Unsupported profile");
                SharedPreferences preferences = getPreferences();
                long pendingEpoch = preferences.getLong(PENDING_EPOCH_KEY, 0L);
                if (pendingEpoch <= 0L) {
                    promise.resolve(buildStatus(
                        "idle",
                        preferences.getLong(COMPLETED_EPOCH_KEY, 0L),
                        0L
                    ));
                    return;
                }
                long deadlineAt = preferences.getLong(PENDING_DEADLINE_KEY, 0L);
                if (System.currentTimeMillis() >= deadlineAt) {
                    promise.resolve(buildStatus("timed-out", pendingEpoch, deadlineAt));
                    return;
                }
                String expectedProfile = preferences.getString(PENDING_PROFILE_KEY, "");
                if (!profile.equals(expectedProfile)) {
                    promise.resolve(buildStatus("mismatch", pendingEpoch, deadlineAt));
                    return;
                }

                String acknowledgementKey = "main".equals(runtime)
                    ? MAIN_ACK_EPOCH_KEY
                    : BACKGROUND_ACK_EPOCH_KEY;
                if (!preferences.edit().putLong(acknowledgementKey, pendingEpoch).commit()) {
                    throw new IllegalStateException("Runtime acknowledgement commit failed");
                }
                promise.resolve(readStatus(preferences, pendingEpoch));
            } catch (Exception error) {
                promise.reject("TRAVEL_MODE_LAUNCH_ACK_FAILED", error.getMessage(), error);
            }
        }
    }

    @ReactMethod
    public void getLaunchStatus(double requestedEpochValue, Promise promise) {
        synchronized (LOCK) {
            try {
                long requestedEpoch = requireEpoch(requestedEpochValue);
                promise.resolve(readStatus(getPreferences(), requestedEpoch));
            } catch (Exception error) {
                promise.reject("TRAVEL_MODE_LAUNCH_STATUS_FAILED", error.getMessage(), error);
            }
        }
    }

    private WritableMap readStatus(SharedPreferences preferences, long requestedEpoch) {
        long completedEpoch = preferences.getLong(COMPLETED_EPOCH_KEY, 0L);
        if (completedEpoch == requestedEpoch) {
            return buildStatus("complete", requestedEpoch, 0L);
        }
        long pendingEpoch = preferences.getLong(PENDING_EPOCH_KEY, 0L);
        if (pendingEpoch != requestedEpoch) {
            return buildStatus("superseded", requestedEpoch, 0L);
        }
        long deadlineAt = preferences.getLong(PENDING_DEADLINE_KEY, 0L);
        if (System.currentTimeMillis() >= deadlineAt) {
            return buildStatus("timed-out", requestedEpoch, deadlineAt);
        }
        boolean mainAcknowledged =
            preferences.getLong(MAIN_ACK_EPOCH_KEY, 0L) == requestedEpoch;
        boolean backgroundAcknowledged =
            preferences.getLong(BACKGROUND_ACK_EPOCH_KEY, 0L) == requestedEpoch;
        if (!mainAcknowledged || !backgroundAcknowledged) {
            return buildStatus("pending", requestedEpoch, deadlineAt);
        }
        boolean committed = preferences.edit()
            .putLong(COMPLETED_EPOCH_KEY, requestedEpoch)
            .remove(PENDING_EPOCH_KEY)
            .remove(PENDING_PROFILE_KEY)
            .remove(PENDING_DEADLINE_KEY)
            .remove(MAIN_ACK_EPOCH_KEY)
            .remove(BACKGROUND_ACK_EPOCH_KEY)
            .commit();
        if (!committed) {
            throw new IllegalStateException("Launch completion commit failed");
        }
        return buildStatus("complete", requestedEpoch, 0L);
    }

    private SharedPreferences getPreferences() {
        return getReactApplicationContext().getSharedPreferences(
            PREFERENCES_NAME,
            Context.MODE_PRIVATE
        );
    }

    private static WritableMap buildStatus(String status, long epoch, long deadlineAt) {
        WritableMap result = Arguments.createMap();
        result.putString("status", status);
        result.putDouble("epoch", (double) epoch);
        if (deadlineAt > 0L) {
            result.putDouble("deadlineAt", (double) deadlineAt);
        }
        return result;
    }

    private static long requireEpoch(double value) {
        long epoch = (long) value;
        if (epoch <= 0L || value != (double) epoch) {
            throw new IllegalArgumentException("Invalid launch epoch");
        }
        return epoch;
    }

    private static boolean isValidControlRecord(JSONObject record) {
        Object enabled = record.opt("enabled");
        Object verifyString = record.opt("verifyString");
        Object version = record.opt("version");
        return enabled instanceof Boolean &&
            verifyString instanceof String &&
            ((String) verifyString).startsWith("|VS|") &&
            !((String) verifyString).equals("|VS|") &&
            version instanceof Number &&
            ((Number) version).intValue() == 1;
    }

    private static void requireSupported(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
