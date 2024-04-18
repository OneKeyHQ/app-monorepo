package so.onekey.app.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

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
    private NotificationManager mNotifyManager;
    private NotificationCompat.Builder mBuilder;
    private ReactApplicationContext rContext;
    private Boolean isDownloading = false;
    private int notifiactionId = 1;


    DownloadModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
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
        if (downloadedFile.exists()){
            downloadedFile.delete();
        }
        mNotifyManager = (NotificationManager)this.rContext.getSystemService(Context.NOTIFICATION_SERVICE);
        mBuilder = new NotificationCompat.Builder(this.rContext.getApplicationContext());
        mBuilder.setContentTitle(notificationTitle)
                .setContentText("")
                .setSmallIcon(R.drawable.ic_launcher_round);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mBuilder.setChannelId(this.rContext.getPackageName());

            NotificationChannel channel = new NotificationChannel(
                    this.rContext.getPackageName(),
                    "updateApp",
                    NotificationManager.IMPORTANCE_HIGH);

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
                Log.i("update/downloading-progress", progress + "");
            } catch (Exception e) {
                Log.e("update/downloading", e.getMessage());
            }
            mBuilder.setProgress(100, progress, false);
            mNotifyManager.notify(notifiactionId, mBuilder.build());
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
        promise.resolve(null);
        this.isDownloading = false;
        mBuilder.setContentText("Download completed").setProgress(0,0,false);
        mNotifyManager.notify(notifiactionId, mBuilder.build());
        this.sendEvent("update/downloaded", null);
    }


    @ReactMethod
    public void installAPK(final String url, final Promise promise) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            File file;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N){
                file = new File(url.replace("file:///", "/"));
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            }else{
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
