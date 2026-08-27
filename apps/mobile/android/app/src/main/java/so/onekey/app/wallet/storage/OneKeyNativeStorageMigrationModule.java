package so.onekey.app.wallet.storage;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.StatFs;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.tencent.mmkv.MMKV;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@ReactModule(name = OneKeyNativeStorageMigrationModule.NAME)
public final class OneKeyNativeStorageMigrationModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OneKeyNativeStorageMigration";

    private static final String ASYNC_STORAGE_DATABASE_NAME = "RKStorage";
    private static final String ASYNC_STORAGE_TABLE_NAME = "catalystLocalStorage";
    private static final String ASYNC_STORAGE_KEY_COLUMN = "key";
    private static final String ASYNC_STORAGE_VALUE_COLUMN = "value";
    private static final int LEGACY_VALUE_CHUNK_BYTES = 256 * 1024;
    private static final int MAX_LEGACY_VALUE_BYTES = 64 * 1024 * 1024;

    private static final String LEDGER_PREFERENCES_NAME = "onekey_native_storage_migration";
    private static final String RECOVERY_PREFERENCES_NAME = "onekey_recovery";
    private static final String RECOVERY_ACTION_KEY = "recovery_action";
    private static final List<String> VALID_LEDGER_KEYS = Arrays.asList(
        "app-storage-v1",
        "jotai-storage-v1"
    );
    private static final List<String> VALID_LEDGER_VALUES = Arrays.asList(
        "complete-v1",
        "migrating-v1",
        "resetting-v1"
    );
    private static final List<String> VALID_RECOVERY_ACTIONS = Arrays.asList(
        "auto_repair",
        "try_again"
    );
    private static final List<String> VALID_MMKV_IDS = Arrays.asList(
        "onekey-app-storage-v1",
        "onekey-app-setting",
        "onekey-cold-start-cache",
        "onekey-app-dev-setting",
        "onekey-jotai-states"
    );

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public OneKeyNativeStorageMigrationModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public void invalidate() {
        executor.shutdownNow();
        super.invalidate();
    }

    @ReactMethod
    public void readLegacyAsyncStorageValue(String key, Promise promise) {
        executor.execute(() -> {
            try {
                promise.resolve(readLegacyValue(key));
            } catch (Exception error) {
                promise.reject("LEGACY_ASYNC_STORAGE_READ_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void getMigrationLedger(String key, Promise promise) {
        executor.execute(() -> {
            try {
                requireSupported(VALID_LEDGER_KEYS.contains(key), "Unsupported migration ledger key");
                String value = getReactApplicationContext()
                    .getSharedPreferences(LEDGER_PREFERENCES_NAME, Context.MODE_PRIVATE)
                    .getString(key, null);
                promise.resolve(value);
            } catch (Exception error) {
                promise.reject("MIGRATION_LEDGER_READ_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void setMigrationLedger(String key, String value, Promise promise) {
        executor.execute(() -> {
            try {
                requireSupported(VALID_LEDGER_KEYS.contains(key), "Unsupported migration ledger key");
                requireSupported(VALID_LEDGER_VALUES.contains(value), "Unsupported migration ledger value");
                boolean committed = getReactApplicationContext()
                    .getSharedPreferences(LEDGER_PREFERENCES_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(key, value)
                    .commit();
                if (!committed) {
                    throw new IllegalStateException("Migration ledger commit failed");
                }
                promise.resolve(null);
            } catch (Exception error) {
                promise.reject("MIGRATION_LEDGER_WRITE_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void peekRecoveryAction(Promise promise) {
        executor.execute(() -> {
            try {
                String action = getReactApplicationContext()
                    .getSharedPreferences(RECOVERY_PREFERENCES_NAME, Context.MODE_PRIVATE)
                    .getString(RECOVERY_ACTION_KEY, "");
                promise.resolve(action == null ? "" : action);
            } catch (Exception error) {
                promise.reject("RECOVERY_ACTION_READ_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void acknowledgeRecoveryAction(String expectedAction, Promise promise) {
        executor.execute(() -> {
            try {
                requireSupported(
                    VALID_RECOVERY_ACTIONS.contains(expectedAction),
                    "Unsupported recovery action"
                );
                SharedPreferences preferences = getReactApplicationContext().getSharedPreferences(
                    RECOVERY_PREFERENCES_NAME,
                    Context.MODE_PRIVATE
                );
                String currentAction = preferences.getString(RECOVERY_ACTION_KEY, "");
                if (!expectedAction.equals(currentAction)) {
                    promise.resolve(false);
                    return;
                }
                if (!preferences.edit().remove(RECOVERY_ACTION_KEY).commit()) {
                    throw new IllegalStateException("Recovery action acknowledgement failed");
                }
                promise.resolve(true);
            } catch (Exception error) {
                promise.reject("RECOVERY_ACTION_ACK_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void syncMMKV(String mmapID, Promise promise) {
        executor.execute(() -> {
            try {
                requireSupported(VALID_MMKV_IDS.contains(mmapID), "Unsupported MMKV instance");
                MMKV mmkv = MMKV.mmkvWithID(mmapID);
                if (mmkv == null) {
                    throw new IllegalStateException("MMKV instance is unavailable");
                }
                mmkv.sync();
                promise.resolve(null);
            } catch (Exception error) {
                promise.reject("MMKV_SYNC_FAILED", error.getMessage(), error);
            }
        });
    }

    @ReactMethod
    public void getMigrationStorageCapacity(Promise promise) {
        executor.execute(() -> {
            try {
                File databaseFile = getReactApplicationContext().getDatabasePath(
                    ASYNC_STORAGE_DATABASE_NAME
                );
                long legacyBytes = fileSize(databaseFile)
                    + fileSize(new File(databaseFile.getPath() + "-wal"))
                    + fileSize(new File(databaseFile.getPath() + "-shm"));
                long availableBytes = new StatFs(
                    getReactApplicationContext().getFilesDir().getPath()
                ).getAvailableBytes();
                WritableMap result = Arguments.createMap();
                result.putDouble("availableBytes", (double) availableBytes);
                result.putDouble("legacyBytes", (double) legacyBytes);
                promise.resolve(result);
            } catch (Exception error) {
                promise.reject("MIGRATION_CAPACITY_READ_FAILED", error.getMessage(), error);
            }
        });
    }

    private static void requireSupported(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }

    private static long fileSize(File file) {
        return file.exists() ? file.length() : 0L;
    }

    private String readLegacyValue(String key) {
        File databaseFile = getReactApplicationContext().getDatabasePath(
            ASYNC_STORAGE_DATABASE_NAME
        );
        if (!databaseFile.exists()) {
            return null;
        }

        try (SQLiteDatabase database = SQLiteDatabase.openDatabase(
            databaseFile.getPath(),
            null,
            SQLiteDatabase.OPEN_READONLY
        )) {
            Integer byteLength = readLegacyValueByteLength(database, key);
            if (byteLength == null) {
                return null;
            }
            if (byteLength > MAX_LEGACY_VALUE_BYTES) {
                throw new IllegalStateException("Legacy AsyncStorage value exceeds the migration limit");
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream(byteLength);
            int offset = 1;
            while (offset <= byteLength) {
                byte[] chunk = readLegacyValueChunk(database, key, offset);
                if (chunk.length == 0) {
                    throw new IllegalStateException(
                        "Legacy AsyncStorage value returned an incomplete chunk"
                    );
                }
                output.write(chunk, 0, chunk.length);
                offset += chunk.length;
            }
            if (output.size() != byteLength) {
                throw new IllegalStateException(
                    "Legacy AsyncStorage value byte count changed during migration"
                );
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static Integer readLegacyValueByteLength(SQLiteDatabase database, String key) {
        String query = "SELECT length(CAST(" + ASYNC_STORAGE_VALUE_COLUMN + " AS BLOB)) "
            + "FROM " + ASYNC_STORAGE_TABLE_NAME + " WHERE " + ASYNC_STORAGE_KEY_COLUMN + " = ?";
        try (Cursor cursor = database.rawQuery(query, new String[]{key})) {
            if (!cursor.moveToFirst()) {
                return null;
            }
            long byteLength = cursor.getLong(0);
            if (byteLength < 0 || byteLength > Integer.MAX_VALUE) {
                throw new IllegalStateException("Legacy AsyncStorage value has an invalid byte count");
            }
            return (int) byteLength;
        }
    }

    private static byte[] readLegacyValueChunk(
        SQLiteDatabase database,
        String key,
        int offset
    ) {
        String query = "SELECT substr(CAST(" + ASYNC_STORAGE_VALUE_COLUMN + " AS BLOB), ?, ?) "
            + "FROM " + ASYNC_STORAGE_TABLE_NAME + " WHERE " + ASYNC_STORAGE_KEY_COLUMN + " = ?";
        try (Cursor cursor = database.rawQuery(
            query,
            new String[]{String.valueOf(offset), String.valueOf(LEGACY_VALUE_CHUNK_BYTES), key}
        )) {
            if (!cursor.moveToFirst() || cursor.isNull(0)) {
                return new byte[0];
            }
            return cursor.getBlob(0);
        }
    }
}
