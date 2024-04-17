package so.onekey.app.wallet;

import android.os.Environment;
import android.database.Cursor;
// import android.widget.Toast;
import android.webkit.MimeTypeMap;
import android.content.IntentFilter;
import android.os.Build;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.app.DownloadManager;

import androidx.core.content.FileProvider;

import java.util.Map;
import java.util.HashMap;
import java.io.File;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;

public class DownloadModule extends ReactContextBaseJavaModule {

    private ReactApplicationContext rContext;

    DownloadModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
    }

    public String getName() {
        return "DownloadManager";
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
            promise.resolve("success");
            rContext.getCurrentActivity().startActivity(intent);
        } catch (Exception e) {
            promise.reject("Error", e.getMessage());
        }
    }
}
