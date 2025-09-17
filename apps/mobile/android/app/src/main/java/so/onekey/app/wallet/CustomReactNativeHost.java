package so.onekey.app.wallet;

import android.content.Context;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.defaults.DefaultReactNativeHost;

import java.io.File;
import java.util.List;

public class CustomReactNativeHost extends DefaultReactNativeHost {
    private Context context;

    public CustomReactNativeHost(Context context) {
        super(context);
        this.context = context;
    }

    @Override
    protected String getJSMainModuleName() {
        return ".expo/.virtual-metro-entry";
    }

    @Override
    public String getJSBundleFile() {
        // Check for updated bundle first
        String bundlePath = BundleUpdateModule.getCurrentBundleMainJSBundle(context);
        if (bundlePath != null) {
            File bundleFile = new File(bundlePath);
            if (bundleFile.exists()) {
                return bundlePath;
            }
        }
        
        // Fallback to default bundle
        return super.getJSBundleFile();
    }
}
