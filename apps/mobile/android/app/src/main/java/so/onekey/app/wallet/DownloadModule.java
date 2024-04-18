package so.onekey.app.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.res.ResourcesCompat;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.File;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
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

public class DownloadModule extends ReactContextBaseJavaModule {
    private NotificationManagerCompat mNotifyManager;
    private NotificationCompat.Builder mBuilder;
    private ReactApplicationContext rContext;
    private Boolean isDownloading = false;
    private int notifiactionId = 1;
    private String channelId = "updateApp";


    DownloadModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
        mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
    }

    public String getName() {
        return "DownloadManager";
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        rContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }


    @ReactMethod
    public void downloadAPK(final String url, final String filePath, final String notificationTitle, final Promise promise) throws IOException {
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;
        File downloadedFile = new File(filePath.replace("file:///", "/"));
        if (downloadedFile.exists()) {
            downloadedFile.delete();
        }

        mBuilder = new NotificationCompat.Builder(this.rContext.getApplicationContext(), channelId)
                .setContentTitle(notificationTitle)
                .setContentText("Download in progress")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSmallIcon(R.drawable.ic_natification);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "updateApp",
                    NotificationManager.IMPORTANCE_DEFAULT);

            mNotifyManager.createNotificationChannel(channel);
        }

        Request request = new Request.Builder().url(url).build();
        Response response = null;
        try {
            response = new OkHttpClient().newCall(request).execute();
        } catch (IOException e) {
            this.isDownloading = false;
            this.sendEvent("update/error", null);
            promise.reject("Error", e.getMessage());
        }
        if (response == null) {
            return;
        }
        ResponseBody body = response.body();
        long contentLength = body.contentLength();
        BufferedSource source = body.source();

        BufferedSink sink = null;
        try {
            sink = Okio.buffer(Okio.sink(downloadedFile));
        } catch (FileNotFoundException e) {
            this.isDownloading = false;
            this.sendEvent("update/error", null);
            promise.reject("Error", e.getMessage());
            throw new RuntimeException(e);
        }
        Buffer sinkBuffer = sink.buffer();

        long totalBytesRead = 0;
        int bufferSize = 8 * 1024;
        this.sendEvent("update/start", null);
        for (long bytesRead; (bytesRead = source.read(sinkBuffer, bufferSize)) != -1; ) {
            try {
                sink.emit();
            } catch (IOException e) {
                this.isDownloading = false;
                this.sendEvent("update/error", null);
                promise.reject("Error", e.getMessage());
                throw new RuntimeException(e);
            }
            totalBytesRead += bytesRead;
            int progress = (int) ((totalBytesRead * 100) / contentLength);
            try {
                WritableMap params = Arguments.createMap();
                params.putInt("progress", progress);
                this.sendEvent("update/downloading", params);
                Log.i("update/progress", progress + "");
            } catch (Exception e) {
                Log.e("update/downloading", e.getMessage());
            }
            mBuilder.setProgress(100, progress, false);
            notifyNotification(notifiactionId, mBuilder);
        }
        try {
            sink.flush();
            sink.close();
            source.close();
        } catch (IOException e) {
            this.isDownloading = false;
            this.sendEvent("update/error", null);
            promise.reject("Error", e.getMessage());
            throw new RuntimeException(e);
        }
        Log.d("UPDATE APP", "downloadAPK: Download completed");
        this.sendEvent("update/downloaded", null);

        this.isDownloading = false;

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, downloadedFile);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        PendingIntent pendingIntent = PendingIntent.getActivity(rContext, 0, installIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        mNotifyManager.cancel(notifiactionId);
        mBuilder.setContentText("Download completed, click to install")
                .setProgress(0, 0, false)
                .setOngoing(false)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        notifyNotification(notifiactionId, mBuilder);
        Log.d("UPDATE APP", "downloadAPK: notifyNotification done");
        promise.resolve(null);
    }


    public void notifyNotification(int notificationId, NotificationCompat.Builder builder) {
        try {
            NotificationManagerCompat mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
            if (ActivityCompat.checkSelfPermission(this.rContext, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            mNotifyManager.notify(notificationId, builder.build());
        } catch(Exception e) {
            Log.e("notifyNotification error", e.getMessage());
        }
    }

    @ReactMethod
    public void installAPK(final String url, final Promise promise) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            File file;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                file = new File(url.replace("file:///", "/"));
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            } else {
                file = new File(url);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            promise.resolve(null);
            rContext.getCurrentActivity().startActivity(intent);
        } catch (Exception e) {
            promise.reject("Error", e.getMessage());
        }
    }
}
