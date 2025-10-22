package so.onekey.app.wallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class BundleUpdateModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BundleUpdateModule";
    private static final String PREFS_NAME = "BundleUpdatePrefs";
    private static final String CURRENT_BUNDLE_VERSION_KEY = "currentBundleVersion";
    private static FileLoggerModule staticFileLogger;
    private ReactApplicationContext reactContext;
    private FileLoggerModule fileLogger;
    private OkHttpClient httpClient;
    private Call currentDownloadCall;
    private boolean isDownloading = false;

    public BundleUpdateModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.fileLogger = new FileLoggerModule(reactContext);
        staticFileLogger = this.fileLogger;
        this.httpClient = new OkHttpClient();
    }

    @Override
    public String getName() {
        return "BundleUpdateModule";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("ANDROID_CHANNEL", BuildConfig.ANDROID_CHANNEL);
        return constants;
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
    }

    private void log(String method, String message) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => BundleUpdate:" + method + ": " + message);
        Log.d(TAG, method + ": " + message);
    }

    public static void staticLog(String method, String message) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        if (staticFileLogger != null) {
            staticFileLogger.write(1, currentTime + " | INFO : app => native => BundleUpdate:" + method + ": " + message);
        }
    }

    // Static utility methods equivalent to iOS
    public static String getDownloadBundleDir(Context context) {
        File downloadDir = new File(context.getFilesDir(), "onekey-bundle-download");
        if (!downloadDir.exists()) {
            downloadDir.mkdirs();
        }
        return downloadDir.getAbsolutePath();
    }

    public static String getBundleDir(Context context) {
        File bundleDir = new File(context.getFilesDir(), "onekey-bundle");
        if (!bundleDir.exists()) {
            bundleDir.mkdirs();
        }
        return bundleDir.getAbsolutePath();
    }

    public static String getCurrentBundleVersion(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(CURRENT_BUNDLE_VERSION_KEY, null);
    }

    public static void setCurrentBundleVersionAndSignature(Context context, String version, String signature) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(CURRENT_BUNDLE_VERSION_KEY, version).putString(version, signature).apply();
    }

    public static void clearUpdateBundleData(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String version = getCurrentBundleVersion(context);
        if (version != null) {
            prefs.edit().remove(version).remove(CURRENT_BUNDLE_VERSION_KEY).apply();
        }
    }

    public static String getCurrentBundleDir(Context context, String currentBundleVersion) {
        if (currentBundleVersion == null) {
            return null;
        }
        return new File(getBundleDir(context), currentBundleVersion).getAbsolutePath();
    }

    public static String getMetadataFilePath(Context context, String currentBundleVersion) {
        if (currentBundleVersion == null) {
            return null;
        }
        File metadataFile = new File(new File(getBundleDir(context), currentBundleVersion), "metadata.json");
        if (!metadataFile.exists()) {
            return null;
        }
        return metadataFile.getAbsolutePath();
    }

    public static String getMetadataFileContent(Context context, String currentBundleVersion) throws IOException {
        String metadataFilePath = getMetadataFilePath(context, currentBundleVersion);
        if (metadataFilePath == null) {
            return null;
        }
        return readFileContent(new File(metadataFilePath));
    }

    public static Map<String, String> parseMetadataJson(String jsonContent) {
        Map<String, String> metadata = new HashMap<>();
        try {
            JSONObject jsonObject = new JSONObject(jsonContent);
            Iterator<String> keys = jsonObject.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = jsonObject.getString(key);
                metadata.put(key, value);
            }
        } catch (Exception e) {
            staticLog(TAG, "Error parsing JSON: " + e.getMessage());
        }
        return metadata;
    }

    public static boolean validateMetadataFileSha256(Context context, String currentBundleVersion, String signature) throws IOException {
        String metadataFilePath = getMetadataFilePath(context, currentBundleVersion);
        if (metadataFilePath == null) {
            staticLog(TAG, "metadataFilePath is null");
            return false;
        }
        String extractedSha256 = readMetadataFileSha256(context, signature);
        if (extractedSha256 == null || extractedSha256.isEmpty()) {
            return false;
        }
        return calculateSHA256(metadataFilePath).equals(extractedSha256);
    }

    public static int compareVersion(String version1, String version2) {
        if (version1 == null && version2 == null) {
            return 0;
        }
        if (version1 == null) {
            return -1;
        }
        if (version2 == null) {
            return 1;
        }
        
        String[] components1 = version1.split("\\.");
        String[] components2 = version2.split("\\.");
        
        int maxCount = Math.max(components1.length, components2.length);
        
        for (int i = 0; i < maxCount; i++) {
            int value1 = 0;
            int value2 = 0;
            
            if (i < components1.length) {
                try {
                    value1 = Integer.parseInt(components1[i]);
                } catch (NumberFormatException e) {
                    value1 = 0;
                }
            }
            
            if (i < components2.length) {
                try {
                    value2 = Integer.parseInt(components2[i]);
                } catch (NumberFormatException e) {
                    value2 = 0;
                }
            }
            
            if (value1 < value2) {
                return -1;
            } else if (value1 > value2) {
                return 1;
            }
        }
        
        return 0;
    }

    public static String getCurrentBundleMainJSBundle(Context context) {
        try {
            String currentAppVersion = getAppVersion(context);
            String currentBundleVersion = getCurrentBundleVersion(context);
            
            staticLog(TAG, "currentAppVersion: " + currentAppVersion + ", currentBundleVersion: " + currentBundleVersion);
            
            String prevNativeVersion = getNativeVersion(context);
            if (prevNativeVersion == null) {
                return null;
            }
            
            if (!currentAppVersion.equals(prevNativeVersion)) {
                staticLog(TAG, "currentAppVersion is not equal to prevNativeVersion " + currentAppVersion + " " + prevNativeVersion);
                BundleUpdateModule.clearUpdateBundleData(context);
                return null;
            }
            
            String bundleDir = getCurrentBundleDir(context, currentBundleVersion);
            if (bundleDir == null || !new File(bundleDir).exists()) {
                staticLog(TAG, "currentBundleDir does not exist");
                return null;
            }
            String signature = null;
            if (currentBundleVersion != null) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                signature = prefs.getString(currentBundleVersion, null);
                staticLog(TAG, "Retrieved signature for key: " + currentBundleVersion + ", signature: " + signature);
            }
            if (!validateMetadataFileSha256(context, currentBundleVersion, signature)) {
                return null;
            }
            Map<String, String> metadata = parseMetadataJson(getMetadataFileContent(context, currentBundleVersion));
            String bundleName = "main.jsbundle.hbc";
            File mainJSBundleFile = new File(bundleDir, bundleName);
            String mainJSBundlePath = mainJSBundleFile.getAbsolutePath();
            staticLog(TAG, "mainJSBundlePath: " + mainJSBundlePath);
            if (!mainJSBundleFile.exists() || mainJSBundlePath == null || mainJSBundlePath.isEmpty()) {
                staticLog(TAG, "mainJSBundleFile does not exist");
                return null;
            }

            String sha256 = metadata.get("main.jsbundle.hbc");
            String calculatedSha256 = calculateSHA256(mainJSBundlePath);
            staticLog(TAG, "calculatedSha256: " + calculatedSha256 + ", sha256: " + sha256);
            if (calculatedSha256 == null || sha256 == null) {
                return null;
            }
            if (!calculatedSha256.equals(sha256)) {
                return null;
            }
            return mainJSBundlePath;
        } catch (IOException e) {
            staticLog(TAG, "Error getting package info: " + e.getMessage());
            return null;
        }
    }

    public static String calculateSHA256(String filePath) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(filePath))) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = bis.read(buffer)) > 0) {
                    digest.update(buffer, 0, count);
                }
            }
            return bytesToHex(digest.digest());
        } catch (Exception e) {
            staticLog(TAG, "Error calculating SHA256: " + e.getMessage());
            return null;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    public static boolean validateAllFilesInDir(Context context, String dirPath, Map<String, String> metadata, String appVersion, String bundleVersion) {
        File dir = new File(dirPath);
        if (!dir.exists() || !dir.isDirectory()) {
            return false;
        }

        String parentBundleDir = getBundleDir(context);
        String folderName = appVersion + "-" + bundleVersion;
        String jsBundleDir = new File(parentBundleDir, folderName).getAbsolutePath() + "/";

        return validateFilesRecursive(dir, metadata, jsBundleDir);
    }

    public static String readMetadataFileSha256(Context context, String signature) {
        String ascFileContentString = signature;
        String extractedSha256 = "";
        String cacheFilePath = context.getCacheDir().getAbsolutePath() + "/bundle-gpg-verification-temp";
        File cacheFile = new File(cacheFilePath);
        if (cacheFile.exists()) {
            cacheFile.delete();
        }
        try {
            String content = Verification.extractedTextContentFromVerifyAscFile(ascFileContentString, cacheFilePath);
            if (content == null || content.isEmpty()) {
                return null;
            }
            JSONObject jsonObject = new JSONObject(content);
            extractedSha256 = jsonObject.getString("sha256");
            staticLog("extractedSha256", extractedSha256);
        } catch (Exception e) {
            staticLog("readMetadataFileSha256", "Error extracting SHA256: " + e.getMessage());
        }
        return extractedSha256;
    }

    private static boolean validateFilesRecursive(File dir, Map<String, String> metadata, String jsBundleDir) {
        File[] files = dir.listFiles();
        if (files == null) {
            return true;
        }

        for (File file : files) {
            if (file.isDirectory()) {
                if (!validateFilesRecursive(file, metadata, jsBundleDir)) {
                    return false;
                }
            } else {
                // Skip metadata.json and .DS_Store
                if (file.getName().contains("metadata.json") || file.getName().contains(".DS_Store")) {
                    continue;
                }

                String relativePath = file.getAbsolutePath().replace(jsBundleDir, "");
                staticLog(TAG, "relativePath: " + relativePath);

                String expectedSHA256 = metadata.get(relativePath);
                if (expectedSHA256 == null) {
                    staticLog(TAG, "File " + relativePath + " not found in metadata");
                    return false;
                }

                String actualSHA256 = calculateSHA256(file.getAbsolutePath());
                if (actualSHA256 == null) {
                    staticLog(TAG, "Failed to calculate SHA256 for file " + relativePath);
                    return false;
                }

                if (!expectedSHA256.equals(actualSHA256)) {
                    staticLog(TAG, "SHA256 mismatch for file " + relativePath + ". Expected: " + expectedSHA256 + ", Actual: " + actualSHA256);
                    return false;
                }
            }
        }
        return true;
    }

    public static File getFallbackUpdateBundleDataFile(ReactContext context) {
        String bundleDir = getBundleDir(context);
        String fallbackUpdateBundleDataPath = bundleDir + "/fallbackUpdateBundleData.json";
        File fallbackUpdateBundleDataFile = new File(fallbackUpdateBundleDataPath);
        if (!fallbackUpdateBundleDataFile.exists()) {
            try {
                fallbackUpdateBundleDataFile.createNewFile();
            } catch (IOException e) {
                staticLog(TAG, "getFallbackUpdateBundleDataFile:" + e.getMessage());
            }
        }
        return fallbackUpdateBundleDataFile;
    }

    public static void writeFileContent(File file, String content) throws IOException {
        if (!file.exists()) {
            file.createNewFile();
        }
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(content.getBytes());
        }
    }

    public static void writeFallbackUpdateBundleDataFile(List<Map<String, String>> fallbackUpdateBundleData, ReactContext context) {
        File fallbackUpdateBundleDataFile = getFallbackUpdateBundleDataFile(context);
        String fallbackUpdateBundleDataString = new JSONArray(fallbackUpdateBundleData).toString();
        try {
            writeFileContent(fallbackUpdateBundleDataFile, fallbackUpdateBundleDataString);
        } catch (IOException e) {
            staticLog(TAG, "writeFallbackUpdateBundleDataFile:" + e.getMessage());
        }
    }

    public static List<Map<String, String>> readFallbackUpdateBundleDataFile(ReactContext context) {
        File fallbackUpdateBundleDataFile = getFallbackUpdateBundleDataFile(context);
        String fallbackUpdateBundleDataString = null;
        try {
            fallbackUpdateBundleDataString = readFileContent(fallbackUpdateBundleDataFile);
        } catch (IOException e) {
            staticLog(TAG, "readFallbackUpdateBundleDataFile:" + e.getMessage());
        }
        if (fallbackUpdateBundleDataString == null || fallbackUpdateBundleDataString.isEmpty()) {
            return new ArrayList<>();
        }
        List<Map<String, String>> fallbackUpdateBundleData = new ArrayList<>();
        try {
            JSONArray jsonArray = new JSONArray(fallbackUpdateBundleDataString);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject jsonObject = jsonArray.getJSONObject(i);
                Map<String, String> map = new HashMap<>();
                Iterator<String> keys = jsonObject.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    map.put(key, jsonObject.getString(key));
                }
                fallbackUpdateBundleData.add(map);
            }
        } catch (JSONException e) {
            staticLog(TAG, "readFallbackUpdateBundleDataFile:" + e.getMessage());
        }
        return fallbackUpdateBundleData;
    }

    public static String getAppVersion(Context context) {
        try {
            PackageManager packageManager = context.getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);
            return packageInfo.versionName;
        } catch (PackageManager.NameNotFoundException e) {
            staticLog(TAG, "Error getting package info: " + e.getMessage());
            return null;
        }
    }

    public static String getNativeVersion(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("nativeVersion", null);
    }

    public static void setNativeVersion(Context context, String nativeVersion) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("nativeVersion", nativeVersion).apply();
    }

    private boolean verifyBundleSHA256(String bundlePath, String sha256) {
        String calculatedSHA256 = calculateSHA256(bundlePath);
        if (calculatedSHA256 == null || sha256 == null) {
            return false;
        }
        
        boolean isValid = calculatedSHA256.equals(sha256);
        log("verifyBundleSHA256", "Calculated: " + calculatedSHA256 + ", Expected: " + sha256 + ", Valid: " + isValid);
        return isValid;
    }

    private void clearDownloadTask() {
        isDownloading = false;
        if (currentDownloadCall != null) {
            currentDownloadCall.cancel();
            currentDownloadCall = null;
        }
    }

    @ReactMethod
    public void downloadBundleASC(ReadableMap params, Promise promise) {
        String downloadUrl = params.getString("downloadUrl");
        String filePath = params.getString("downloadedFile");
        String signature = params.getString("signature");
        String appVersion = params.getString("latestVersion");
        int bundleVersion = params.getInt("bundleVersion");
        String sha256 = params.getString("sha256");

        if (downloadUrl == null || filePath == null || signature == null || appVersion == null || bundleVersion == 0 || sha256 == null) {
            promise.reject("INVALID_PARAMS", "downloadUrl, filePath, signature, appVersion, bundleVersion and sha256 are required");
            return;
        }

        String storageKey = appVersion + "-" + bundleVersion;
        SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(storageKey, signature).apply();

        log("downloadASC", "Stored signature for key: " + storageKey);
        promise.resolve(null);
    }

    @ReactMethod
    public void verifyBundleASC(ReadableMap params, Promise promise) {
        String filePath = params.getString("downloadedFile");
        String sha256 = params.getString("sha256");
        String appVersion = params.getString("latestVersion");
        int bundleVersion = params.getInt("bundleVersion");
        String signature = params.getString("signature");

        if (filePath == null || sha256 == null) {
            promise.reject("INVALID_PARAMS", "filePath and sha256 are required");
            return;
        }

        if (!verifyBundleSHA256(filePath, sha256)) {
            promise.reject("INVALID_PARAMS", "Bundle signature verification failed");
            return;
        }

        String folderName = appVersion + "-" + bundleVersion;
        String destination = new File(getBundleDir(reactContext), folderName).getAbsolutePath();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                unzipFile(filePath, destination);
            } else {
                promise.reject("INVALID_PARAMS", "android version not supported, minimum version is 8.0");
                return;
            }

            String metadataJsonPath = new File(destination, "metadata.json").getAbsolutePath();
            File metadataFile = new File(metadataJsonPath);
            if (!metadataFile.exists()) {
                promise.reject("INVALID_PARAMS", "Failed to read metadata.json");
                return;
            }

            String currentBundleVersion = appVersion + "-" + bundleVersion;
            if (!validateMetadataFileSha256(reactContext, currentBundleVersion, signature)) {
                promise.reject("INVALID_PARAMS", "Bundle signature verification failed");
                return;
            }
            promise.resolve(null);
        } catch (Exception e) {
            log("verifyBundle", "Error: " + e.getMessage());
            promise.reject("INVALID_PARAMS", "Error processing bundle: " + e.getMessage());
        }
    }

    @ReactMethod
    public void verifyBundle(ReadableMap params, Promise promise) {
        String filePath = params.getString("downloadedFile");
        String sha256 = params.getString("sha256");
        String appVersion = params.getString("latestVersion");
        int bundleVersion = params.getInt("bundleVersion");

        if (filePath == null || sha256 == null) {
            promise.reject("INVALID_PARAMS", "filePath and sha256 are required");
            return;
        }

        if (!verifyBundleSHA256(filePath, sha256)) {
            promise.reject("INVALID_PARAMS", "Bundle signature verification failed");
            return;
        }
        String folderName = appVersion + "-" + bundleVersion;
        String destination = new File(getBundleDir(reactContext), folderName).getAbsolutePath();
        try {
            String metadataJsonPath = new File(destination, "metadata.json").getAbsolutePath();
            File metadataFile = new File(metadataJsonPath);
            if (!metadataFile.exists()) {
                promise.reject("INVALID_PARAMS", "Failed to read metadata.json");
                return;
            }

            // Read and parse metadata.json
            String metadataContent = readFileContent(metadataFile);
            Map<String, String> metadata = parseMetadataJson(metadataContent);

            if (!validateAllFilesInDir(reactContext, destination, metadata, appVersion, String.valueOf(bundleVersion))) {
                promise.reject("INVALID_PARAMS", "Bundle signature verification failed");
                return;
            }
            promise.resolve(null);
        } catch (Exception e) {
            log("verifyBundle", "Error: " + e.getMessage());
            promise.reject("INVALID_PARAMS", "Error processing bundle: " + e.getMessage());
        }
    }

    @ReactMethod
    public void downloadBundle(ReadableMap params, Promise promise) {
        if (isDownloading) {
            promise.resolve(null);
            return;
        }

        isDownloading = true;

        String appVersion = params.getString("latestVersion");
        long bundleVersion = params.getLong("bundleVersion");
        String downloadUrl = params.getString("downloadUrl");
        long fileSize = params.getLong("fileSize");
        String sha256 = params.getString("sha256");

        if (downloadUrl == null || sha256 == null || appVersion == null || bundleVersion == 0) {
            isDownloading = false;
            promise.reject("INVALID_PARAMS", "downloadUrl, fileSize, sha256, appVersion and bundleVersion are required");
            return;
        }

        String fileName = appVersion + "-" + bundleVersion + ".zip";
        String filePath = new File(getDownloadBundleDir(reactContext), fileName).getAbsolutePath();
        
        WritableMap result = Arguments.createMap();
        result.putString("downloadedFile", filePath);
        result.putString("downloadUrl", downloadUrl);
        result.putString("latestVersion", appVersion);
        result.putLong("bundleVersion", bundleVersion);
        result.putString("sha256", sha256);

        log("downloadBundle", "filePath: " + filePath);
        
        File downloadedFile = new File(filePath);
        if (downloadedFile.exists()) {
            if (verifyBundleSHA256(filePath, sha256)) {
                // Simulate delay like iOS
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    promise.resolve(result);
                    clearDownloadTask();
                    sendEvent("update/complete", null);
                }, 5000);
                return;
            } else {
                downloadedFile.delete();
            }
        }

        // Start download
        Request request = new Request.Builder().url(downloadUrl).build();
        currentDownloadCall = httpClient.newCall(request);
        
        sendEvent("update/start", null);
        currentDownloadCall.enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                clearDownloadTask();
                WritableMap errorParams = Arguments.createMap();
                errorParams.putString("error", e.getMessage());
                sendEvent("update/error", errorParams);
                promise.reject("DOWNLOAD_ERROR", e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    clearDownloadTask();
                    WritableMap errorParams = Arguments.createMap();
                    errorParams.putString("error", String.valueOf(response.code()));
                    sendEvent("update/error", errorParams);
                    promise.reject("DOWNLOAD_ERROR", "HTTP " + response.code());
                    return;
                }

                try (InputStream inputStream = response.body().byteStream();
                     FileOutputStream outputStream = new FileOutputStream(filePath)) {
                    
                    byte[] buffer = new byte[8192];
                    long totalBytesRead = 0;
                    long contentLength = fileSize > 0 ? fileSize : response.body().contentLength();
                    
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                        totalBytesRead += bytesRead;
                        
                        if (contentLength > 0) {
                            double progress = (double) totalBytesRead / (double) contentLength;
                            WritableMap progressParams = Arguments.createMap();
                            progressParams.putDouble("progress", progress * 100);
                            sendEvent("update/downloading", progressParams);
                        }
                    }
                }

                if (!verifyBundleSHA256(filePath, sha256)) {
                    clearDownloadTask();
                    new File(filePath).delete();
                    WritableMap errorParams = Arguments.createMap();
                    errorParams.putString("error", "Bundle signature verification failed");
                    sendEvent("update/error", errorParams);
                    promise.reject("VERIFICATION_ERROR", "Bundle signature verification failed");
                    return;
                }

                sendEvent("update/complete", null);
                log("downloadBundle", "Download completed");
                clearDownloadTask();
            }
        });
        promise.resolve(result);
    }

    @ReactMethod
    public void installBundle(ReadableMap params, Promise promise) {
        String appVersion = params.getString("latestVersion");
        int bundleVersion = params.getInt("bundleVersion");
        String filePath = params.getString("downloadedFile");
        String signature = params.getString("signature");
        
        if (filePath == null || appVersion == null || bundleVersion == 0) {
            promise.reject("INVALID_PARAMS", "filePath, appVersion and bundleVersion are required");
            return;
        }

        String folderName = appVersion + "-" + bundleVersion;
        String currentFolderName = getCurrentBundleVersion(reactContext);
        setCurrentBundleVersionAndSignature(reactContext, folderName, signature);
        setNativeVersion(reactContext, getAppVersion(reactContext));
        List<Map<String, String>> fallbackUpdateBundleData = readFallbackUpdateBundleDataFile(reactContext);
       
        if (currentFolderName != null && !currentFolderName.isEmpty()) {
            String currentAppVersion = currentFolderName.split("-")[0];
            String currentBundleVersion = currentFolderName.split("-")[1];
            SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            signature = prefs.getString(currentBundleVersion, null);
            fallbackUpdateBundleData.add(Map.of("appVersion", currentAppVersion, "bundleVersion", currentBundleVersion, "signature", signature));
        }

        if (fallbackUpdateBundleData.size() > 3) {
            Map<String, String> shiftUpdateBundleData = fallbackUpdateBundleData.remove(0);
            String shiftAppVersion = shiftUpdateBundleData.get("appVersion");
            String shiftBundleVersion = shiftUpdateBundleData.get("bundleVersion");
            if (shiftAppVersion != null && shiftBundleVersion != null) {
                String shiftFolderName = shiftAppVersion + "-" + shiftBundleVersion;
                SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().remove(shiftFolderName).apply();
                String bundleDir = getBundleDir(reactContext);
                String bundleDirPath = new File(bundleDir, shiftFolderName).getAbsolutePath();
                if (new File(bundleDirPath).exists()) {
                    deleteDirectory(new File(bundleDirPath));
                }
            }
        }
        writeFallbackUpdateBundleDataFile(fallbackUpdateBundleData, reactContext);
        promise.resolve(null);
    }

    @ReactMethod
    public void getFallbackUpdateBundleData(Promise promise) {
        List<Map<String, String>> fallbackUpdateBundleData = readFallbackUpdateBundleDataFile(reactContext);
        promise.resolve(fallbackUpdateBundleData);
    }

    @ReactMethod
    public void setCurrentUpdateBundleData(ReadableMap params, Promise promise) {
        String appVersion = params.getString("appVersion");
        int bundleVersion = params.getInt("bundleVersion");
        String signature = params.getString("signature");
        String folderName = appVersion + "-" + bundleVersion;
        setCurrentBundleVersionAndSignature(reactContext, folderName, signature);
        promise.resolve(null);
    }
       
    @ReactMethod
    public void clearBundle(Promise promise) {
        try {
            File downloadBundleDir = new File(getDownloadBundleDir(reactContext));
            if (downloadBundleDir.exists()) {
                deleteDirectory(downloadBundleDir);
            }
            
            if (currentDownloadCall != null) {
                currentDownloadCall.cancel();
                currentDownloadCall = null;
            }
            clearDownloadTask();
            promise.resolve(null);
        } catch (Exception e) {
            staticLog(TAG, "clearBundle:" + e.getMessage());
            promise.reject("CLEAR_ERROR", e.getMessage());
        }
    }

    // Helper methods
    @RequiresApi(api = Build.VERSION_CODES.O)
    private void unzipFile(String zipFilePath, String destDirectory) throws IOException {
        File destDir = new File(destDirectory);
        if (!destDir.exists()) {
            destDir.mkdirs();
        }

        // Normalize destination directory path for security checks
        Path destDirPath = Paths.get(destDir.getCanonicalPath());

        try (ZipInputStream zipIn = new ZipInputStream(new FileInputStream(zipFilePath))) {
            ZipEntry entry = zipIn.getNextEntry();
            while (entry != null) {
                String entryName = entry.getName();
                // Construct normalized output path
                File outFile = new File(destDir, entryName);
                Path outPath = Paths.get(outFile.getCanonicalPath());

                // Ensure that the output file is within the destination directory
                if (!outPath.startsWith(destDirPath)) {
                    throw new IOException("Entry is outside of the target dir: " + entryName);
                }

                if (!entry.isDirectory()) {
                    extractFile(zipIn, outPath.toString());
                } else {
                    File dir = outPath.toFile();
                    dir.mkdirs();
                }
                zipIn.closeEntry();
                entry = zipIn.getNextEntry();
            }
        }
    }

    public static String getWebEmbedPath(Context context) {
        String currentBundleDir = getCurrentBundleDir(context, getCurrentBundleVersion(context));
        if (currentBundleDir == null) {
            return "";
        }
        return new File(currentBundleDir, "web-embed").getAbsolutePath();
    }

    @ReactMethod
    public void getWebEmbedPathAsync(Promise promise) {
        String webEmbedPath = BundleUpdateModule.getWebEmbedPath(reactContext);
        staticLog("getWebEmbedPathAsync", "webEmbedPath: " + webEmbedPath);
        promise.resolve(webEmbedPath);
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getWebEmbedPath() {
        String webEmbedPath = BundleUpdateModule.getWebEmbedPath(reactContext);
        staticLog("getWebEmbedPath", "webEmbedPath: " + webEmbedPath);
        return webEmbedPath;
    }

    @ReactMethod
    public void clearAllJSBundleData(Promise promise) {
        File downloadBundleDir = new File(getDownloadBundleDir(reactContext));
        if (downloadBundleDir.exists()) {
            deleteDirectory(downloadBundleDir);
        }
        File bundleDir = new File(getBundleDir(reactContext));
        if (bundleDir.exists()) {
            deleteDirectory(bundleDir);
        }
        BundleUpdateModule.clearUpdateBundleData(reactContext);
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", true);
        result.putString("message", "Successfully cleared all JS bundle data");
        promise.resolve(result);
    }

    @ReactMethod
    public void testVerification(Promise promise) {
        String cacheFilePath = reactContext.getCacheDir().getAbsolutePath() + "/bundle-gpg-test-verification-temp";
        boolean result = false;
        try {
            result = Verification.testExtractedSha256FromVerifyAscFile(cacheFilePath);
        } catch (Exception e) {
            staticLog(TAG, "testVerification:" + e.getMessage());
            throw new RuntimeException(e);
        }
        promise.resolve(result);
    }

    @ReactMethod
    public void testDeleteJsBundle(String appVersion, int bundleVersion, Promise promise) {
        String folderName = appVersion + "-" + bundleVersion;
        String bundleDir = getBundleDir(reactContext);
        String jsBundlePath = new File(new File(bundleDir, folderName), "main.jsbundle.hbc").getAbsolutePath();
        
        File jsBundleFile = new File(jsBundlePath);
        if (jsBundleFile.exists()) {
            boolean success = jsBundleFile.delete();
            if (success) {
                log("testDeleteJsBundle", "Deleted jsBundle: " + jsBundlePath);
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "Deleted jsBundle: " + jsBundlePath);
                promise.resolve(result);
            } else {
                log("testDeleteJsBundle", "Error deleting jsBundle: " + jsBundlePath);
                promise.reject("DELETE_ERROR", "Failed to delete jsBundle: " + jsBundlePath);
            }
        } else {
            log("testDeleteJsBundle", "jsBundle not found: " + jsBundlePath);
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("message", "jsBundle not found: " + jsBundlePath);
            promise.resolve(result);
        }
    }

    @ReactMethod
    public void testDeleteJsRuntimeDir(String appVersion, int bundleVersion, Promise promise) {
        String folderName = appVersion + "-" + bundleVersion;
        String bundleDir = getBundleDir(reactContext);
        String jsRuntimeDir = new File(bundleDir, folderName).getAbsolutePath();
        
        File jsRuntimeDirFile = new File(jsRuntimeDir);
        if (jsRuntimeDirFile.exists()) {
            deleteDirectory(jsRuntimeDirFile);
            boolean success = !jsRuntimeDirFile.exists();
            if (success) {
                log("testDeleteJsRuntimeDir", "Deleted js runtime directory: " + jsRuntimeDir);
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "Deleted js runtime directory: " + jsRuntimeDir);
                promise.resolve(result);
            } else {
                log("testDeleteJsRuntimeDir", "Error deleting js runtime directory: " + jsRuntimeDir);
                promise.reject("DELETE_ERROR", "Failed to delete js runtime directory: " + jsRuntimeDir);
            }
        } else {
            log("testDeleteJsRuntimeDir", "js runtime directory not found: " + jsRuntimeDir);
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("message", "js runtime directory not found: " + jsRuntimeDir);
            promise.resolve(result);
        }
    }

    @ReactMethod
    public void testDeleteMetadataJson(String appVersion, int bundleVersion, Promise promise) {
        String folderName = appVersion + "-" + bundleVersion;
        String bundleDir = getBundleDir(reactContext);
        String metadataPath = new File(new File(bundleDir, folderName), "metadata.json").getAbsolutePath();
        
        File metadataFile = new File(metadataPath);
        if (metadataFile.exists()) {
            boolean success = metadataFile.delete();
            if (success) {
                log("testDeleteMetadataJson", "Deleted metadata.json: " + metadataPath);
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "Deleted metadata.json: " + metadataPath);
                promise.resolve(result);
            } else {
                log("testDeleteMetadataJson", "Error deleting metadata.json: " + metadataPath);
                promise.reject("DELETE_ERROR", "Failed to delete metadata.json: " + metadataPath);
            }
        } else {
            log("testDeleteMetadataJson", "metadata.json not found: " + metadataPath);
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", false);
            result.putString("message", "metadata.json not found: " + metadataPath);
            promise.resolve(result);
        }
    }

    @ReactMethod
    public void testWriteEmptyMetadataJson(String appVersion, int bundleVersion, Promise promise) {
        String folderName = appVersion + "-" + bundleVersion;
        String bundleDir = getBundleDir(reactContext);
        String jsRuntimeDir = new File(bundleDir, folderName).getAbsolutePath();
        String metadataPath = new File(jsRuntimeDir, "metadata.json").getAbsolutePath();
        
        File jsRuntimeDirFile = new File(jsRuntimeDir);
        
        // Ensure directory exists
        if (!jsRuntimeDirFile.exists()) {
            boolean success = jsRuntimeDirFile.mkdirs();
            if (!success) {
                log("testWriteEmptyMetadataJson", "Error creating directory: " + jsRuntimeDir);
                promise.reject("CREATE_DIR_ERROR", "Failed to create directory: " + jsRuntimeDir);
                return;
            }
        }
        
        // Write empty metadata.json
        try {
            JSONObject emptyMetadata = new JSONObject();
            String jsonString = emptyMetadata.toString(2); // Pretty print with 2 spaces
            
            try (FileOutputStream fos = new FileOutputStream(metadataPath)) {
                fos.write(jsonString.getBytes("UTF-8"));
                fos.flush();
            }
            
            log("testWriteEmptyMetadataJson", "Created empty metadata.json: " + metadataPath);
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            result.putString("message", "Created empty metadata.json: " + metadataPath);
            promise.resolve(result);
        } catch (Exception e) {
            log("testWriteEmptyMetadataJson", "Error writing empty metadata.json: " + e.getMessage());
            promise.reject("WRITE_ERROR", "Failed to write empty metadata.json: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getNativeAppVersion(Promise promise) {
        String nativeVersion = getAppVersion(reactContext);
        if (nativeVersion == null) {
            promise.resolve("");
            return;
        }
        promise.resolve(nativeVersion);
    }

    @ReactMethod
    public void getJsBundlePath(Promise promise) {
        String jsBundlePath = getCurrentBundleMainJSBundle(reactContext);
        if (jsBundlePath == null) {
            promise.resolve("");
            return;
        }
        promise.resolve(jsBundlePath);
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String jsBundlePath() {
        String jsBundlePath = getCurrentBundleMainJSBundle(reactContext);
        if (jsBundlePath == null) {
            return "";
        }
        return jsBundlePath;
    }

    private void extractFile(ZipInputStream zipIn, String filePath) throws IOException {
        File file = new File(filePath);
        file.getParentFile().mkdirs();
        
        try (FileOutputStream fos = new FileOutputStream(file)) {
            byte[] buffer = new byte[1024];
            int length;
            while ((length = zipIn.read(buffer)) > 0) {
                fos.write(buffer, 0, length);
            }
        }
    }

    private static String readFileContent(File file) throws IOException {
        StringBuilder content = new StringBuilder();
        try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = bis.read(buffer)) != -1) {
                content.append(new String(buffer, 0, bytesRead));
            }
        }
        return content.toString();
    }

    private void deleteDirectory(File directory) {
        if (directory.exists()) {
            File[] files = directory.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isDirectory()) {
                        deleteDirectory(file);
                    } else {
                        file.delete();
                    }
                }
            }
            directory.delete();
        }
    }
}
