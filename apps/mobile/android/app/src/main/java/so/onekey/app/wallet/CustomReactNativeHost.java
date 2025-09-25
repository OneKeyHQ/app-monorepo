package so.onekey.app.wallet;

import android.app.Application;
import android.content.Context;
import com.facebook.react.defaults.DefaultReactNativeHost;
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
        // String bundlePath = BundleUpdateModule.getCurrentBundleMainJSBundle(context);
        // if (bundlePath != null) {
        //     File bundleFile = new File(bundlePath);
        //     if (bundleFile.exists()) {
        //         return bundlePath;
        //     }
        // }
        
        // Fallback to default bundle
        return super.getJSBundleFile();
    }
}
