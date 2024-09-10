package so.onekey.app.wallet;

import org.bouncycastle.openpgp.PGPPublicKeyRing;
import org.bouncycastle.openpgp.PGPSignature;
import org.bouncycastle.openpgp.PGPSignatureList;
import org.bouncycastle.openpgp.jcajce.JcaPGPObjectFactory;
import org.bouncycastle.openpgp.operator.jcajce.JcaKeyFingerprintCalculator;
import org.bouncycastle.openpgp.operator.jcajce.JcaPGPContentVerifierBuilderProvider;
import java.util.Base64;
import java.io.ByteArrayInputStream;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
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
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.TimeUnit;

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
    private Thread rThread;
    private boolean isDownloading = false;

    public AutoUpdateModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
        mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
    }

    @Override
    public String getName() {
        return "AutoUpdateModule";
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        rContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
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

    public boolean checkFilePackage(File file, @Nullable String downloadUrl,  Promise promise) {
        PackageManager pm = getReactApplicationContext().getPackageManager();
        PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), 0);
        String appPackageName = getReactApplicationContext().getPackageName();
        if (info != null && info.packageName != null) {
            Log.d("check-packageName:", info.packageName + " " + appPackageName + " " + String.valueOf(info.packageName.equals(appPackageName)));
            if (!info.packageName.equals(appPackageName)) {
                promise.reject(new Exception("Installation package name mismatch"));
                return false;
            }
        }

        // Verify SHA256 and GPG signature
        try {
            // Fetch the signature file
            String ascFileUrl = downloadUrl + ".SHA256SUMS.asc";
            OkHttpClient client = new OkHttpClient();
            Request request = new Request.Builder()
                .url(ascFileUrl)
                .build();
            Response response = client.newCall(request).execute();
            if (!response.isSuccessful()) throw new IOException("Unexpected code " + response);
            
            StringBuilder ascFileContent = new StringBuilder();
            String line = "";
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body().byteStream()))) {
                while ((line = reader.readLine()) != null) {
                    ascFileContent.append(line).append("\n");
                }
            }

            String ascFileContentString = ascFileContent.toString();
            if (ascFileContentString.isEmpty()) {
                promise.reject(new Exception("Installation package possibly compromised"));
                return false;
            }
            Log.d("ascFileContent", ascFileContentString);

            // Verify GPG signature
            // Extract SHA256 from the verified content
            String cacheFilePath = getReactApplicationContext().getCacheDir().getAbsolutePath() + "/gpg-verification-temp";
            File cacheFile = new File(cacheFilePath);
            if (cacheFile.exists()) {
                cacheFile.delete();
            }
            String extractedSha256 = Verification.extractedSha256FromVerifyAscFile(ascFileContentString, cacheFilePath);
            Log.d("extractedSha256", extractedSha256);

            if (extractedSha256.isEmpty()) {
                promise.reject(new Exception("Installation package possibly compromised"));
                return false;
            }
            
            // Verify SHA256
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(file))) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = bis.read(buffer)) > 0) {
                    digest.update(buffer, 0, count);
                }
            }
            String calculatedSha256 = bytesToHex(digest.digest());

            Log.d("cal-sha256", calculatedSha256 + " " + extractedSha256 + " " + String.valueOf(calculatedSha256.equals(extractedSha256)));
            if (!calculatedSha256.equals(extractedSha256)) {
                promise.reject(new Exception("Installation package possibly compromised"));
                return false;
            }
            
            return true;
        } catch (Exception e) {
            promise.reject(e);
            return false;
        }
    }

    @ReactMethod void verifyAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String downloadUrl = map.getString("downloadUrl");

        File downloadedFile = buildFile(filePath);
        if (!downloadedFile.exists()) {
            promise.reject(new Exception("The APK file does not exist."));
        }
        boolean isValidAPK = this.checkFilePackage(downloadedFile, downloadUrl, promise);
        if (isValidAPK) {
            promise.resolve(null);
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
        String url = map.getString("url");
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
                        .setContentText("Download in progress")
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
                    sendDownloadError(new Exception("Server not responding, please try again later."), promise);
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
                                Log.i("update/progress", progress + "");
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
                Log.d("UPDATE APP", "downloadPackage: Download completed");
                sendEvent("update/downloaded", null);

                if (this.checkInterrupt()) {
                    return;
                }
                isDownloading = false;

                Intent installIntent = new Intent(Intent.ACTION_VIEW);

                boolean isValidAPK = checkFilePackage(downloadedFile, url, promise);
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, downloadedFile);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                PendingIntent pendingIntent = isValidAPK ? PendingIntent.getActivity(rContext, 0, installIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                        : null;

                mNotifyManager.cancel(NOTIFICATION_ID);
                mBuilder.setContentText("Download completed, click to install")
                        .setProgress(0, 0, false)
                        .setOngoing(false)
                        .setContentIntent(pendingIntent)
                        .setAutoCancel(true);

                notifyNotification(NOTIFICATION_ID, mBuilder);
                Log.d("UPDATE APP", "downloadPackage: notifyNotification done");
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
            Log.d("notification", e.getMessage());
        }
    }

    @ReactMethod
    public void installAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String downloadUrl = map.getString("downloadUrl");
        File file = buildFile(filePath);
        if (!this.checkFilePackage(file, downloadUrl, promise)) {
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
