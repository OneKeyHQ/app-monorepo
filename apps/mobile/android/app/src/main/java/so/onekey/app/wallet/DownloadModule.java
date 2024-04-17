package so.onekey.app.wallet;

import android.os.Environment;
import android.database.Cursor;
import android.webkit.MimeTypeMap;
import android.content.IntentFilter;
import android.os.Build;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.app.DownloadManager;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;

import java.io.IOException;
import java.util.Map;
import java.util.HashMap;
import java.io.File;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMap;
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

    private ReactApplicationContext rContext;
    private Boolean isDownloading = false;

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
    public void downloadAPK(final String url, final String filePath, final Promise promise) throws IOException {
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;
        File downloadedFile = new File(filePath);

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

        BufferedSink sink = Okio.buffer(Okio.sink(new File(filePath)));
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
        }
        sink.flush();
        sink.close();
        source.close();
        promise.resolve(null);
        this.sendEvent("update/downloaded", null);
        this.isDownloading = false;
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
