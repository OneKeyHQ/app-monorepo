package so.onekey.app.wallet;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import io.intercom.android.sdk.Injector;
import io.intercom.android.sdk.Intercom;
import io.intercom.android.sdk.IntercomError;
import io.intercom.android.sdk.IntercomStatusCallback;
import io.intercom.android.sdk.UserAttributes;
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
  public void refreshUnreadCount(String languageOverride, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        // Intercom 18.10.0 otherwise acknowledges unchanged attributes without
        // a request. Reset only attribute deduplication; keep SDK auth and limits.
        Injector.get().getDeDuper().reset();
        UserAttributes attributes = new UserAttributes.Builder()
            .withLanguageOverride(languageOverride).build();
        Intercom.client().updateUser(attributes, new IntercomStatusCallback() {
          @Override
          public void onSuccess() {
            promise.resolve(null);
          }

          @Override
          public void onFailure(@NonNull IntercomError error) {
            promise.reject("INTERCOM_UNREAD_REFRESH_FAILED",
                "Failed to refresh Intercom unread state");
          }
        });
      } catch (Exception error) {
        promise.reject("INTERCOM_UNREAD_REFRESH_FAILED",
            "Failed to refresh Intercom unread state");
      }
    });
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
