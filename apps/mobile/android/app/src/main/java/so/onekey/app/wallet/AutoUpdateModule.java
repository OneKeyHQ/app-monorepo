package so.onekey.app.wallet;

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
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.File;
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

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import okio.BufferedSink;
import okio.BufferedSource;
import okio.Okio;

public class AutoUpdateModule extends ReactContextBaseJavaModule {
    private NotificationManagerCompat mNotifyManager;
    private NotificationCompat.Builder mBuilder;
    private ReactApplicationContext rContext;
    private Boolean isDownloading = false;
    private int notifiactionId = 1;
    private String channelId = "updateApp";


    AutoUpdateModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
        mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
    }

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
        StringBuffer result = new StringBuffer();
        for (byte byt : bytes) {
            result.append(Integer.toString((byt & 0xff) + 0x100, 16).substring(1));
        }
        return result.toString();
    }

    public boolean checkFilePackage(File file, @Nullable String sha256, Promise promise) {
        PackageManager pm = rContext.getPackageManager();
        PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), 0);
        Log.d("check-packageName:", info.packageName + " " + rContext.getPackageName());
        if (info.packageName != rContext.getPackageName()) {
            promise.reject(new Exception("Installation package name mismatch"));
            return false;
        }

        byte[] buffer= new byte[8192];
        int count;
        MessageDigest digest = null;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            promise.reject(e);
            return false;
        }
        BufferedInputStream bis = null;
        try {
            bis = new BufferedInputStream(new FileInputStream(file));
        } catch (FileNotFoundException e) {
            promise.reject(e);
            return false;
        }
        while (true) {
            try {
                if (!((count = bis.read(buffer)) > 0)) break;
            } catch (IOException e) {
                promise.reject(e);
                return false;
            }
            digest.update(buffer, 0, count);
        }
        try {
            bis.close();
        } catch (IOException e) {
            promise.reject(e);
            return false;
        }

        String fileSha256 = this.bytesToHex(digest.digest());
        Log.d("cal-sha256", sha256 + "" + fileSha256);
        if (fileSha256 != sha256) {
            promise.reject(new Exception("Installation package possibly compromised"));
            return false;
        }

        return true;
    }

    @ReactMethod
    public void downloadAPK(final ReadableMap map, final Promise promise) {
        String url = map.getString("url");
        String filePath = map.getString("filePath");
        String notificationTitle = map.getString("notificationTitle");
        String sha256 = map.getString("sha256");
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;
        new Thread(new Runnable() {
            public void run() {
                File downloadedFile = buildFile(filePath);
                if (downloadedFile.exists()) {
                    downloadedFile.delete();
                }

                mBuilder = new NotificationCompat.Builder(rContext.getApplicationContext(), channelId)
                        .setContentTitle(notificationTitle)
                        .setContentText("Download in progress")
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .setSmallIcon(R.drawable.ic_notification);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(channelId, "updateApp", NotificationManager.IMPORTANCE_DEFAULT);

                    mNotifyManager.createNotificationChannel(channel);
                }

                Request request = new Request.Builder().url(url).build();
                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(10, TimeUnit.MILLISECONDS)
                        .build();
                Response response = null;
                try {
                    response = client.newCall(request).execute();
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
                            notifyNotification(notifiactionId, mBuilder);
                            prevProgress = progress;
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

                isDownloading = false;

                Intent installIntent = new Intent(Intent.ACTION_VIEW);


                boolean isValidAPK = checkFilePackage(downloadedFile, sha256, promise);
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, downloadedFile);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                PendingIntent pendingIntent = isValidAPK ? PendingIntent.getActivity(rContext, 0, installIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                        : null;

                mNotifyManager.cancel(notifiactionId);
                mBuilder.setContentText("Download completed, click to install")
                        .setProgress(0, 0, false)
                        .setOngoing(false)
                        .setContentIntent(pendingIntent)
                        .setAutoCancel(true);

                notifyNotification(notifiactionId, mBuilder);
                Log.d("UPDATE APP", "downloadPackage: notifyNotification done");
                promise.resolve(null);
            }
        }).start();
    }


    public void notifyNotification(int notificationId, NotificationCompat.Builder builder) {
        try {
            NotificationManagerCompat mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
            if (ActivityCompat.checkSelfPermission(this.rContext, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            mNotifyManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            Log.e("notifyNotification error", e.getMessage());
        }
    }

    @ReactMethod
    public void installAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String sha256 = map.getString("sha256");
        File file = buildFile(filePath);
        if (!this.checkFilePackage(file, sha256, promise)) {
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
