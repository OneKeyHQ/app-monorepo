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
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
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

    public static String getCurrentBundleMainJSBundle(Context context) {
        try {
            PackageInfo packageInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            String currentAppVersion = packageInfo.versionName;
            String currentBundleVersion = getCurrentBundleVersion(context);
            
            staticLog(TAG, "currentAppVersion: " + currentAppVersion + ", currentBundleVersion: " + currentBundleVersion);
            
            if (currentBundleVersion == null) {
                return null;
            }
            
            if (currentAppVersion != null) {
                String bundleAppVersion = currentBundleVersion.split("-")[0];
                if (!currentAppVersion.equals(bundleAppVersion)) {
                    return null;
                }
            }
            
            String bundleDir = getCurrentBundleDir(context, currentBundleVersion);
            if (bundleDir == null || !new File(bundleDir).exists()) {
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
        } catch (PackageManager.NameNotFoundException e) {
            staticLog(TAG, "Error getting package info: " + e.getMessage());
            return null;
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
        int bundleVersion = params.getInt("bundleVersion");
        String downloadUrl = params.getString("downloadUrl");
        int fileSize = params.getInt("fileSize");
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
        result.putInt("bundleVersion", bundleVersion);
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
                }, 10000);
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
                    long contentLength = response.body().contentLength();
                    
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
