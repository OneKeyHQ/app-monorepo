package so.onekey.app.wallet;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

public class OneKeyNetworkThrottleModule extends ReactContextBaseJavaModule {
  static final String NAME = "OneKeyNetworkThrottle";

  OneKeyNetworkThrottleModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void getConfig(Promise promise) {
    promise.resolve(OneKeyNetworkThrottle.getConfig());
  }

  @ReactMethod
  public void setConfig(ReadableMap config, Promise promise) {
    promise.resolve(OneKeyNetworkThrottle.setConfig(config));
  }
}
