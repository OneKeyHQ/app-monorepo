package so.onekey.app.wallet;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import java.util.Collections;
import java.util.Map;

final class OneKeyIntercomModule extends ReactContextBaseJavaModule {
  OneKeyIntercomModule(ReactApplicationContext context) {
    super(context);
  }

  @NonNull
  @Override
  public String getName() {
    return "OneKeyIntercom";
  }

  private BaseMainApplication application() {
    return (BaseMainApplication) getReactApplicationContext().getApplicationContext();
  }

  @Override
  public Map<String, Object> getConstants() {
    return Collections.singletonMap("initialized", application().isIntercomInitialized());
  }

  @ReactMethod
  public void updateLockPolicy(boolean locked, double validFromMs,
      double lockAtMs, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      application().intercomLockGuard.updateLockPolicy(
          locked, validFromMs, lockAtMs);
      promise.resolve(null);
    });
  }
}
