package so.onekey.app.wallet.reactModule;

import android.content.Context;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactMethod;

import java.io.IOException;

import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.util.Log;
import com.facebook.react.bridge.Callback;

public class HttpServerModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  ReactApplicationContext reactContext;

  private static final String MODULE_NAME = "HTTPServerManager";

  private int port;
  private static Server server = null;
  private Callback listener = null;

  public HttpServerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    reactContext.addLifecycleEventListener(this);
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void start(int port, String serviceName, Callback callback) {
    Log.d(MODULE_NAME, "Initializing server...");
    this.port = port;
    this.listener = callback;
    startServer();
  }

  @ReactMethod
  public void stop() {
    Log.d(MODULE_NAME, "Stopping server...");

    stopServer();
  }

  @ReactMethod
  public void respond(String requestId, int code, String type, String body) {
    if (server != null) {
      server.respond(requestId, code, type, body);
    }
  }

  @Override
  public void onHostResume() {

  }

  @Override
  public void onHostPause() {

  }

  @Override
  public void onHostDestroy() {
    stopServer();
  }

  private void startServer() {
    if (this.port == 0) {
      return;
    }

    if (server == null) {
      server = new Server(reactContext, port);
    }
    try {
      server.start();
      if (this.listener != null) {
        String ipAddress = getIpAddress();
        if (ipAddress != null) {
          this.listener.invoke("http://" + getIpAddress() + ":" + port + "/", true);
        } else {
          this.listener.invoke("", false);
        }
      }
    } catch (IOException e) {
      if (this.listener != null) {
        this.listener.invoke("", false);
      }
      Log.e(MODULE_NAME, e.getMessage());
    }
  }

  private void stopServer() {
    if (server != null) {
      server.stop();
      server = null;
      port = 0;
    }
  }

  /**
   * 获取本机IPv4地址
   *
   * @return 本机IPv4地址；null：无网络连接
   */
  public  String getIpAddress() {
    // 获取WiFi服务
    WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    // 判断WiFi是否开启
    if (wifiManager.isWifiEnabled()) {
      // 已经开启了WiFi
      WifiInfo wifiInfo = wifiManager.getConnectionInfo();
      int ipAddress = wifiInfo.getIpAddress();
      return intToIp(ipAddress);
    } else {
      // 没有开启WiFi
      return null;
    }
  }

  private static String intToIp(int ipAddress) {
    return (ipAddress & 0xFF) + "." +
        ((ipAddress >> 8) & 0xFF) + "." +
        ((ipAddress >> 16) & 0xFF) + "." +
        (ipAddress >> 24 & 0xFF);
  }
}