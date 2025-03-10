package so.onekey.app.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.icu.text.SimpleDateFormat;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.File;
import java.io.InputStreamReader;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.security.MessageDigest;
import java.util.Date;
import java.util.concurrent.TimeUnit;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import javax.net.ssl.HttpsURLConnection;

import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import okio.BufferedSink;
import okio.BufferedSource;
import okio.Okio;

public class AutoUpdateModule extends ReactContextBaseJavaModule {
    private static final String CHANNEL_ID = "updateApp";
    private static final int NOTIFICATION_ID = 1;
    private NotificationManagerCompat mNotifyManager;
    private NotificationCompat.Builder mBuilder;
    private ReactApplicationContext rContext;
    private FileLoggerModule fileLogger;
    private Thread rThread;
    private boolean isDownloading = false;

    public AutoUpdateModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
        mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    @Override
    public String getName() {
        return "AutoUpdateModule";
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        rContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => AutoUpdate:" + name + ": " + msg);
    }

    private void sendDownloadError(Exception e, Promise promise) {
        isDownloading = false;
        WritableMap params = Arguments.createMap();
        params.putString("message", e.getMessage());
        sendEvent("update/error", params);
        promise.reject(e);
    }

    private File buildFile(String path) {
        return new File(path.replace("file:///", "/"));
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(Integer.toString((b & 0xff) + 0x100, 16).substring(1));
        }
        return result.toString();
    }

    public boolean checkFilePackage(File file, Promise promise) {
        PackageManager pm = getReactApplicationContext().getPackageManager();
        PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), 0);
        String appPackageName = getReactApplicationContext().getPackageName();
        if (info != null && info.packageName != null) {
            log("checkFilePackage", info.packageName + " " + appPackageName + " " + String.valueOf(info.packageName.equals(appPackageName)));
            if (!info.packageName.equals(appPackageName)) {
                promise.reject(new Exception("PACKAGE_NAME_MISMATCH"));
                return false;
            }
        }

        // Verify SHA256
        try {
            String extractedSha256 = getSha256(file.getAbsolutePath());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(file))) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = bis.read(buffer)) > 0) {
                    digest.update(buffer, 0, count);
                }
            }
            String calculatedSha256 = bytesToHex(digest.digest());

            log("calSha256 ", calculatedSha256 + " " + extractedSha256 + " " + String.valueOf(calculatedSha256.equals(extractedSha256)));
            if (!calculatedSha256.equals(extractedSha256)) {
                promise.reject(new Exception("UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT"));
                return false;
            }
            
            return true;
        } catch (Exception e) {
            promise.reject(e);
            return false;
        }
    }

    public String getSha256(final String filePath) {
        File ascFile = buildFile(filePath + ".SHA256SUMS.asc");
        if (!ascFile.exists()) {
            return "";
        }
        String cacheFilePath = getReactApplicationContext().getCacheDir().getAbsolutePath() + "/gpg-verification-temp";
        File cacheFile = new File(cacheFilePath);
        if (cacheFile.exists()) {
            cacheFile.delete();
        }
        String ascFileContentString = "";
        try {
            BufferedReader reader = new BufferedReader(new FileReader(ascFile));
            StringBuilder content = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
            reader.close();
            ascFileContentString = content.toString();
        } catch (IOException e) {
            log("AutoUpdateModule", "Error reading ASC file: " + e.getMessage());
            return "";
        }
        String extractedSha256 = "";
        try {
            extractedSha256 = Verification.extractedSha256FromVerifyAscFile(ascFileContentString, cacheFilePath);
            log("extractedSha256", extractedSha256);
        } catch (Exception e) {
            log("AutoUpdateModule", "Error extracting SHA256: " + e.getMessage());
        }
        return extractedSha256;
    }

    @ReactMethod
    public void verifyASC(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String downloadUrl = map.getString("downloadUrl");
        // Verify GPG signature
        // Extract SHA256 from the verified content
        try {
            String extractedSha256 = getSha256(filePath);
            if (extractedSha256.isEmpty()) {
                promise.reject(new Exception("UPDATE_SIGNATURE_VERIFICATION_FAILED_ALERT_TEXT"));
                return;
            }
            promise.resolve(null);
        } catch (Exception e) {
            log("verifyASC", "Error verifying ASC file: " + e.getMessage());
            promise.reject(new Exception("UPDATE_SIGNATURE_VERIFICATION_FAILED_ALERT_TEXT"));
        }
    }

    @ReactMethod
    public void downloadASC(final ReadableMap map, final Promise promise) {
         String url = map.getString("downloadUrl");
         String filePath = map.getString("filePath");
         // Fetch the signature file
         String ascFileUrl = url + ".SHA256SUMS.asc";
         String ascFilePath = filePath + ".SHA256SUMS.asc";
         
         try {
            OkHttpClient client = new OkHttpClient();
            Request request = new Request.Builder()
                .url(ascFileUrl)
                .build();
             Response response = client.newCall(request).execute();
             if (!response.isSuccessful()) {
                 promise.reject(new IOException(String.valueOf(response.code())));
                 return;
             }
             
             StringBuilder ascFileContent = new StringBuilder();
             String line = "";
             try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body().byteStream()))) {
                 while ((line = reader.readLine()) != null) {
                     ascFileContent.append(line).append("\n");
                 }
             }

             String ascFileContentString = ascFileContent.toString();
             if (ascFileContentString.isEmpty()) {
                 promise.reject(new Exception(""));
                 return;
             }
             log("ascFileContent", ascFileContentString);
            // Write the ASC file content to the specified path
            File ascFile = buildFile(ascFilePath);
            if (ascFile.exists()) {
                ascFile.delete();
            }
            
            try (FileOutputStream fos = new FileOutputStream(ascFile)) {
                fos.write(ascFileContentString.getBytes());
            }
            
            promise.resolve(null);
         } catch (Exception e) {
            log("downloadASC", "Error writing ASC file: " + e.getMessage());
            promise.reject(e);
         }
    }

    @ReactMethod void verifyAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");

        File downloadedFile = buildFile(filePath);
        if (!downloadedFile.exists()) {
            promise.reject(new Exception("NOT_FOUND_PACKAGE"));
        }
        boolean isValidAPK = this.checkFilePackage(downloadedFile, promise);
        if (isValidAPK) {
            promise.resolve(null);
        } else {
            promise.reject(new Exception("UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT"));
        }
    }

    @ReactMethod
    public void clearCache(final Promise promise) {
        if (this.rThread != null) {
            this.rThread.interrupt();
        }
        this.isDownloading = false;
        promise.resolve(null);
    }

    @ReactMethod
    public void downloadAPK(final ReadableMap map, final Promise promise) {
        String url = map.getString("downloadUrl");
        String filePath = map.getString("filePath");
        String notificationTitle = map.getString("notificationTitle");
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;
        this.rThread = new Thread(new Runnable() {
            private Call call;
            boolean checkInterrupt() {
                boolean isInterrupted = Thread.currentThread().isInterrupted();
                if (isInterrupted && call != null) {
                    this.call.cancel();
                }
                return isInterrupted;
            };

            public void run() {
                File downloadedFile = buildFile(filePath);
                if (downloadedFile.exists()) {
                    downloadedFile.delete();
                }

                mBuilder = new NotificationCompat.Builder(rContext.getApplicationContext(), CHANNEL_ID)
                        .setContentTitle(notificationTitle)
                        .setContentText("")
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .setSmallIcon(R.drawable.ic_notification);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "updateApp", NotificationManager.IMPORTANCE_DEFAULT);
                    mNotifyManager.createNotificationChannel(channel);
                }

                Request request = new Request.Builder().url(url).build();
                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(10, TimeUnit.SECONDS)
                        .build();
                Response response = null;
                this.call = client.newCall(request);
                try {
                    response = this.call.execute();
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }

                if (!response.isSuccessful()) {
                    sendDownloadError(new Exception(String.valueOf(response.code())), promise);
                    return;
                }

                ResponseBody body = response.body();
                long contentLength = body.contentLength();
                BufferedSource source = body.source();

                BufferedSink sink = null;
                try {
                    sink = Okio.buffer(Okio.sink(downloadedFile));
                } catch (FileNotFoundException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                Buffer sinkBuffer = sink.buffer();

                long totalBytesRead = 0;
                int bufferSize = 8 * 1024;
                sendEvent("update/start", null);
                int prevProgress = 0;
                try {
                    for (long bytesRead; (bytesRead = source.read(sinkBuffer, bufferSize)) != -1;) {
                        try {
                            sink.emit();
                        } catch (IOException e) {
                            sendDownloadError(e, promise);
                            return;
                        }
                        totalBytesRead += bytesRead;
                        int progress = (int) ((totalBytesRead * 100) / contentLength);
                        if (prevProgress != progress) {
                            try {
                                WritableMap params = Arguments.createMap();
                                params.putInt("progress", progress);
                                sendEvent("update/downloading", params);
                                log("update/progress", progress + "");
                            } catch (Exception e) {
                                sendDownloadError(e, promise);
                                return;
                            }
                            mBuilder.setProgress(100, progress, false);
                            notifyNotification(NOTIFICATION_ID, mBuilder);
                            prevProgress = progress;
                            if (this.checkInterrupt()) {
                                return;
                            }
                        }
                    }
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                try {
                    sink.flush();
                    sink.close();
                    source.close();
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                log("downloadAPK", "downloadPackage: Download completed");
                sendEvent("update/downloaded", null);

                if (this.checkInterrupt()) {
                    return;
                }
                isDownloading = false;

                // Intent installIntent = new Intent(Intent.ACTION_VIEW);

                // boolean isValidAPK = checkFilePackage(downloadedFile, url, promise);
                // Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, downloadedFile);
                // installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                // installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                // installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                // PendingIntent pendingIntent = isValidAPK ? PendingIntent.getActivity(rContext, 0, installIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                //         : null;

                mNotifyManager.cancel(NOTIFICATION_ID);
                mBuilder.setContentText("")
                        .setProgress(0, 0, false)
                        .setOngoing(false)
                        // .setContentIntent(pendingIntent)
                        .setAutoCancel(true);

                notifyNotification(NOTIFICATION_ID, mBuilder);
                log("downloadAPKFailed", "downloadPackage: notifyNotification done");
                promise.resolve(null);
            }
        });
        this.rThread.start();
    }


    public void notifyNotification(int notificationId, NotificationCompat.Builder builder) {
        try {
            NotificationManagerCompat mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
            if (ActivityCompat.checkSelfPermission(this.rContext, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            mNotifyManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            log("notifyNotification", e.getMessage());
        }
    }

    @ReactMethod
    public void installAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        File file = buildFile(filePath);
        if (!this.checkFilePackage(file, promise)) {
            promise.reject("NOT_FOUND_PACKAGE");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            } else {
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            promise.resolve(null);
            rContext.getCurrentActivity().startActivity(intent);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
