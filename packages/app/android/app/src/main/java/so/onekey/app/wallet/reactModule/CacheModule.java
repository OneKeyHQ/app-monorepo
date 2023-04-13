package so.onekey.app.wallet.reactModule;

import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.app.Activity;

import android.util.Log;


public class CacheModule extends ReactContextBaseJavaModule {
  ReactApplicationContext reactContext;

  private static final String MODULE_NAME = "CacheManager";

  public CacheModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void clearWebViewData(Promise promise) {
    try {
      Activity activity = reactContext.getCurrentActivity();
      if (activity == null) {
        promise.reject("Activity is null");
        return;
      }
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          WebView webView = new WebView(reactContext);
          webView.clearCache(true);
          webView.clearHistory();
          webView.clearFormData();
          webView.clearSslPreferences();

          // 清除 Cookie
          CookieManager cookieManager = CookieManager.getInstance();
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.removeAllCookies(value -> promise.resolve(true));
            cookieManager.flush();
          } else {
            cookieManager.removeAllCookie();
            promise.resolve(true);
          }

          // 清除 WebStorage 数据
          WebStorage.getInstance().deleteAllData();
        }
      });
    } catch (Exception e) {
      Log.e(MODULE_NAME, e.getMessage());
      promise.reject(e);
    }
  }
}