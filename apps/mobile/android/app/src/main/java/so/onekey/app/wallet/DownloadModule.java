package so.onekey.app.wallet;

import android.app.NotificationManager;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

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
        File downloadedFile = new File(filePath);

        mBuilder = new NotificationCompat.Builder(this.rContext.getCurrentActivity());
        mBuilder.setContentTitle(notificationTitle)
                .setContentText("")
                .setSmallIcon(R.mipmap.ic_launcher_round);

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

        BufferedSink sink = Okio.buffer(Okio.sink(new File(filePath.replace("file:///", "/"))));
        Buffer sinkBuffer = sink.buffer();

        long totalBytesRead = 0;
        int bufferSize = 8 * 1024;
        this.sendEvent("update/start", null);
        for (long bytesRead; (bytesRead = source.read(sinkBuffer, bufferSize)) != -1; ) {
            sink.emit();
            totalBytesRead += bytesRead;
            int progress = (int) ((totalBytesRead * 100) / contentLength);
            WritableMap params = Arguments.createMap();
            params.putInt("progress", progress);
            this.sendEvent("update/downloading", params);
            mBuilder.setProgress(100, progress, false);
            mNotifyManager.notify(this.notifiactionId, mBuilder.build());
        }
        sink.flush();
        sink.close();
        source.close();
        promise.resolve(null);
        this.sendEvent("update/downloaded", null);
        this.isDownloading = false;
        mBuilder.setContentText("Download completed").setProgress(0,0,false);
        mNotifyManager.notify(this.notifiactionId, mBuilder.build());
        notifiactionId += 1;
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
