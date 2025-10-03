

package so.onekey.app.wallet;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import java.util.HashMap;
import java.util.Map;

public class AutoUpdateGoogleModule extends ReactContextBaseJavaModule {
    public AutoUpdateGoogleModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "AutoUpdateModule";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("ANDROID_CHANNEL", "google");
        return constants;
    }
}
