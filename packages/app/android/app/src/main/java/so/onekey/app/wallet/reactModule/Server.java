package so.onekey.app.wallet.reactModule;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.google.common.base.MoreObjects;

import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.Random;

import javax.annotation.Nullable;

import android.content.Context;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.util.Log;

public class Server extends NanoHTTPD {
  private static final String TAG = "HttpServer";
  private static final String SERVER_EVENT_ID = "httpServerResponseReceived";

  private ReactContext reactContext;
  private Map<String, Response> responses;

  public Server(ReactContext context, int port) {
    super(port);
    reactContext = context;
    responses = new HashMap<>();

    Log.d(TAG, "Server started");
  }

  @Override
  public Response serve(IHTTPSession session) {
    Log.d(TAG, "Request received!");

    // 判断是否为跨域预请求
    if (isPreflightRequest(session)) {
      // 如果是则发送CORS响应告诉浏览HTTP服务支持的METHOD及HEADERS和请求源
      return responseCORS(session);
    }

    Random rand = new Random();
    String requestId = String.format("%d:%d", System.currentTimeMillis(), rand.nextInt(1000000));

    WritableMap request;
    try {
      request = fillRequestMap(session, requestId);
    } catch (Exception e) {
      return newFixedLengthResponse(
          Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.getMessage()
      );
    }

    this.sendEvent(reactContext, SERVER_EVENT_ID, request);

    while (responses.get(requestId) == null) {
      try {
        Thread.sleep(10);
      } catch (Exception e) {
        Log.d(TAG, "Exception while waiting: " + e);
      }
    }
    Response response = responses.get(requestId);
    responses.remove(requestId);
    return wrapResponse(session, response);
  }

  public void respond(String requestId, int code, String type, String body) {
    responses.put(requestId, newFixedLengthResponse(Status.lookup(code), type, body));

    // Response response = responses.get(requestId);
    // response.put(requestId, newFixedLengthResponse(Status.lookup(code), type, body));
    // response.addHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    // response.addHeader("Access-Control-Allow-Origin", "GET, POST, OPTIONS");
    // response.addHeader("Access-Control-Allow-Methods", "*");
  }

  private WritableMap fillRequestMap(IHTTPSession session, String requestId) throws Exception {
    Method method = session.getMethod();

    String queryParam = session.getQueryParameterString();

    WritableMap request = Arguments.createMap();
    if (method.name().equalsIgnoreCase("GET") && queryParam != null) {
      request.putString("url", session.getUri() + "?" + queryParam);
    } else {
      request.putString("url", session.getUri());
    }
    request.putString("type", method.name());
    request.putString("requestId", requestId);

    Map<String, String> files = new HashMap<>();
    session.parseBody(files);
    if (files.size() > 0) {
      request.putString("postData", files.get("postData"));
    }

    return request;
  }

  private void sendEvent(ReactContext reactContext, String eventName, @Nullable WritableMap params) {
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
  }

  /**
   * 判断是否为CORS 预检请求请求(Preflight)
   *
   * @param session
   * @return
   */
  private static boolean isPreflightRequest(IHTTPSession session) {
    Map<String, String> headers = session.getHeaders();
    return Method.OPTIONS.equals(session.getMethod())
        && headers.containsKey("origin")
        && headers.containsKey("access-control-request-method")
        && headers.containsKey("access-control-request-headers");
  }

  /**
   * 向响应包中添加CORS包头数据
   *
   * @param session
   * @return
   */
  private Response responseCORS(IHTTPSession session) {
    Response resp = wrapResponse(session, newFixedLengthResponse(""));
    Map<String, String> headers = session.getHeaders();
    resp.addHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");

    String requestHeaders = headers.get("access-control-request-headers");
    String allowHeaders = MoreObjects.firstNonNull(requestHeaders, "Content-Type");
    resp.addHeader("Access-Control-Allow-Headers", allowHeaders);
    //resp.addHeader("Access-Control-Max-Age", "86400");
    resp.addHeader("Access-Control-Max-Age", "0");
    return resp;
  }

  /**
   * 封装响应包
   *
   * @param session http请求
   * @param resp    响应包
   * @return resp
   */
  private Response wrapResponse(IHTTPSession session, Response resp) {
    if (null != resp) {
      Map<String, String> headers = session.getHeaders();
      resp.addHeader("Access-Control-Allow-Credentials", "true");
      // 如果请求头中包含'Origin',则响应头中'Access-Control-Allow-Origin'使用此值否则为'*'
      // nanohttd将所有请求头的名称强制转为了小写
      String origin = MoreObjects.firstNonNull(headers.get("origin"), "*");
      resp.addHeader("Access-Control-Allow-Origin", origin);

      String requestHeaders = headers.get("access-control-request-headers");
      if (requestHeaders != null) {
        resp.addHeader("Access-Control-Allow-Headers", requestHeaders);
      }
    }
    return resp;
  }
}