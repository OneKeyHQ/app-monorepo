package so.onekey.app.wallet;

import android.app.Application;
import android.content.Context;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import java.io.File;

public abstract class CustomReactNativeHost extends DefaultReactNativeHost {
    private Context context;

    public CustomReactNativeHost(Application application) {
        super(application);
        this.context = application;
    }

    @Override
    protected String getJSMainModuleName() {
        return ".expo/.virtual-metro-entry";
    }

    @Override
    public String getJSBundleFile() {
        // Check for updated bundle first
        String bundlePath = BundleUpdateStoreAndroid.INSTANCE.getCurrentBundleMainJSBundle(context);
        if (bundlePath != null) {
            File bundleFile = new File(bundlePath);
            if (bundleFile.exists()) {
                OneKeyLog.info("BundleUpdate", "getJSBundleFile: using OTA bundle path=" + bundlePath);
                return bundlePath;
            }
            OneKeyLog.warn("BundleUpdate", "getJSBundleFile: OTA path not found, path=" + bundlePath);
        } else {
            OneKeyLog.info("BundleUpdate", "getJSBundleFile: OTA path is null");
        }
        
        // Fallback to default bundle
        String fallbackPath = super.getJSBundleFile();
        OneKeyLog.info("BundleUpdate", "getJSBundleFile: fallback bundle path=" + fallbackPath);
        return fallbackPath;
    }
}
