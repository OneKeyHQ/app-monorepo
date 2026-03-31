package so.onekey.app.wallet;

import android.content.Context;
import android.content.res.AssetManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * SplitBundleLoader - Native module for production split bundle segment loading (Phase 2)
 *
 * Provides two methods to JS:
 * 1. getRuntimeBundleContext() - Returns current runtime's bundle paths and source kind
 * 2. loadSegment(params) - Registers a HBC segment with the current Hermes runtime
 */
public class SplitBundleLoaderModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "SplitBundleLoader";
    private static final String BUILTIN_EXTRACT_DIR = "onekey-builtin-segments";

    public SplitBundleLoaderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    // -----------------------------------------------------------------------
    // getRuntimeBundleContext
    // -----------------------------------------------------------------------

    @ReactMethod
    public void getRuntimeBundleContext(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            String runtimeKind = "main";
            String sourceKind = "builtin";
            String bundleRoot = "";
            String nativeVersion = "";
            String bundleVersion = "";

            try {
                nativeVersion = context.getPackageManager()
                        .getPackageInfo(context.getPackageName(), 0).versionName;
            } catch (Exception ignored) {
            }

            // Check OTA bundle path
            String otaBundlePath = getOtaBundlePath();
            if (otaBundlePath != null && !otaBundlePath.isEmpty()) {
                File otaFile = new File(otaBundlePath);
                if (otaFile.exists()) {
                    sourceKind = "ota";
                    bundleRoot = otaFile.getParent();
                }
            }

            String builtinExtractRoot = new File(
                    context.getFilesDir(),
                    BUILTIN_EXTRACT_DIR + "/" + nativeVersion
            ).getAbsolutePath();

            WritableMap result = Arguments.createMap();
            result.putString("runtimeKind", runtimeKind);
            result.putString("sourceKind", sourceKind);
            result.putString("bundleRoot", bundleRoot);
            result.putString("builtinExtractRoot", builtinExtractRoot);
            result.putString("nativeVersion", nativeVersion);
            result.putString("bundleVersion", bundleVersion);

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("SPLIT_BUNDLE_CONTEXT_ERROR", e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // loadSegment
    // -----------------------------------------------------------------------

    @ReactMethod
    public void loadSegment(ReadableMap params, Promise promise) {
        try {
            int segmentId = params.getInt("segmentId");
            String segmentKey = params.getString("segmentKey");
            String relativePath = params.getString("relativePath");

            if (relativePath == null || relativePath.isEmpty()) {
                promise.reject("SPLIT_BUNDLE_INVALID_PARAMS",
                        "relativePath is required");
                return;
            }

            String absolutePath = resolveSegmentPath(relativePath);
            if (absolutePath == null) {
                promise.reject("SPLIT_BUNDLE_NOT_FOUND",
                        "Segment file not found: " + relativePath + " (key=" + segmentKey + ")");
                return;
            }

            // Register segment via ReactInstanceManager
            ReactApplicationContext reactContext = getReactApplicationContext();
            if (reactContext.hasCatalystInstance()) {
                reactContext.getCatalystInstance()
                        .registerSegment(segmentId, absolutePath);
                promise.resolve(null);
            } else {
                promise.reject("SPLIT_BUNDLE_NO_INSTANCE",
                        "CatalystInstance not available");
            }
        } catch (Exception e) {
            promise.reject("SPLIT_BUNDLE_LOAD_ERROR", e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // Path resolution helpers
    // -----------------------------------------------------------------------

    private String resolveSegmentPath(String relativePath) {
        // 1. Try OTA bundle directory first
        String otaBundlePath = getOtaBundlePath();
        if (otaBundlePath != null && !otaBundlePath.isEmpty()) {
            File otaRoot = new File(otaBundlePath).getParentFile();
            if (otaRoot != null) {
                File candidate = new File(otaRoot, relativePath);
                if (candidate.exists()) {
                    return candidate.getAbsolutePath();
                }
            }
        }

        // 2. Try builtin: extract from assets if needed
        return extractBuiltinSegmentIfNeeded(relativePath);
    }

    /**
     * For Android builtin segments, APK assets can't be passed directly as file paths.
     * Extract the asset to the extract cache directory on first access.
     */
    private String extractBuiltinSegmentIfNeeded(String relativePath) {
        Context context = getReactApplicationContext();
        String nativeVersion;
        try {
            nativeVersion = context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (Exception e) {
            nativeVersion = "unknown";
        }

        File extractDir = new File(context.getFilesDir(),
                BUILTIN_EXTRACT_DIR + "/" + nativeVersion);
        File extractedFile = new File(extractDir, relativePath);

        // Already extracted
        if (extractedFile.exists()) {
            return extractedFile.getAbsolutePath();
        }

        // Extract from assets
        AssetManager assets = context.getAssets();
        try (InputStream is = assets.open(relativePath)) {
            File parentDir = extractedFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            try (FileOutputStream fos = new FileOutputStream(extractedFile)) {
                byte[] buffer = new byte[8192];
                int len;
                while ((len = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, len);
                }
            }
            return extractedFile.getAbsolutePath();
        } catch (IOException e) {
            // Asset not found in builtin
            return null;
        }
    }

    private String getOtaBundlePath() {
        // Access BundleUpdateStore via reflection to get OTA bundle path
        try {
            Class<?> bundleUpdateStore = Class.forName(
                    "expo.modules.onekeybundleupdate.BundleUpdateStore");
            java.lang.reflect.Method method = bundleUpdateStore.getMethod(
                    "getCurrentBundleMainJSBundle", Context.class);
            Object result = method.invoke(null, getReactApplicationContext());
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
