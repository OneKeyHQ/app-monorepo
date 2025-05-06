package so.onekey.app.wallet;

import android.os.Build;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.StorageController;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.scroll.ScrollEventType;

import java.util.Map;

public class GeckoViewManager extends SimpleViewManager<View> {
    public static final String REACT_CLASS = "GeckoView";
    private static GeckoRuntime mGeckoRuntime = null;
    private @Nullable  String mUserAgent;

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    public View createViewInstance(ThemedReactContext c) {
        if (mGeckoRuntime == null) {
            mGeckoRuntime = GeckoRuntime.create(c);
        }
        return new GeckoViewExtended(c,mGeckoRuntime);
    }

    @ReactProp(name = "source")
    public void setSource(GeckoViewExtended view, @Nullable ReadableMap source) {
        view.setSource(source);
    }

    @ReactProp(name = "forceDarkOn")
    public void setForceDarkMode(GeckoViewExtended view, boolean allowed) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            view.setForceDarkAllowed(allowed);
        }

    }

    @ReactProp(name = "injectedJavaScript")
    public void setinjectedJavaScript(GeckoViewExtended view, String javascript) {
        view.setInjectedJavaScript(javascript);

    }

    @ReactProp(name = "autoFillEnabled")
    public void setAutoFill(GeckoViewExtended view, boolean allowed) {
        mGeckoRuntime.getSettings().setLoginAutofillEnabled(allowed);
    }

    @ReactProp(name = "remoteDebugging")
    public void setUserAgent(GeckoViewExtended view, boolean allowed) {
        mGeckoRuntime.getSettings().setRemoteDebuggingEnabled(allowed);

    }

    @ReactProp(name = "userAgent")
    public void setUserAgent(GeckoViewExtended view, @Nullable String userAgent) {

        if (userAgent != null) {
            mUserAgent = userAgent;
        } else {
            mUserAgent = null;
        }
        view.getSession().getSettings().setUserAgentOverride(mUserAgent);
    }

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        Map export = super.getExportedCustomDirectEventTypeConstants();
        if (export == null) {
            export = MapBuilder.newHashMap();
        }
        // Default events but adding them here explicitly for clarity
        export.put("topLoadingStart", MapBuilder.of("registrationName", "onLoadingStart"));
        export.put("topLoadingFinish", MapBuilder.of("registrationName", "onLoadingFinish"));
        export.put("topLoadingError", MapBuilder.of("registrationName", "onLoadingError"));
        export.put("topMessage", MapBuilder.of("registrationName", "onMessage"));
        // !Default events but adding them here explicitly for clarity

        export.put("topLoadingProgress", MapBuilder.of("registrationName", "onLoadingProgress"));
        export.put("topShouldStartLoadWithRequest", MapBuilder.of("registrationName", "onShouldStartLoadWithRequest"));
        export.put(ScrollEventType.getJSEventName(ScrollEventType.SCROLL), MapBuilder.of("registrationName", "onScroll"));
        export.put("topHttpError", MapBuilder.of("registrationName", "onHttpError"));
        export.put("topRenderProcessGone", MapBuilder.of("registrationName", "onRenderProcessGone"));
        export.put("topMessagingDisconnected", MapBuilder.of("registrationName", "onMessageDisconnected"));
        return export;
    }


    @Override
    public void receiveCommand(@NonNull View root, String commandId, @Nullable ReadableArray args) {
        GeckoViewExtended webView = (GeckoViewExtended) root;
        switch (commandId) {
            case "goBack":
                webView.getSession().goBack();
                break;
            case "goForward":
                webView.getSession().goForward();
                break;
            case "reload":
                webView.getSession().reload();
                break;
            case "stopLoading":
                webView.getSession().stop();
                break;
            case "connectMessagingPort":
                webView.connectMessagingPort(null);
                break;
            case "postMessage":
                try {
                    JSONObject eventInitDict = new JSONObject();
                    eventInitDict.put("data", args.getString(0));
                    if (webView.messagePort == null) {
                        webView.connectMessagingPort(eventInitDict);
                        return;
                    }
                    webView.messagePort.postMessage(eventInitDict);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                break;
            case "injectJavaScript":
                try {
                    JSONObject eventInitDict = new JSONObject();
                    eventInitDict.put("inject", args.getString(0));
                    if (webView.messagePort == null) {
                        webView.connectMessagingPort(eventInitDict);
                        return;
                    }
                    webView.messagePort.postMessage(eventInitDict);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                break;
            case "loadUrl":
                if (args == null) {
                    throw new RuntimeException("Arguments for loading an url are null!");
                }
                webView.getSession().loadUri(args.getString(0));
                break;
            case "requestFocus":
                webView.requestFocus();
                break;
            case "clearFormData":

                break;
            case "clearCache":
                //boolean includeDiskFiles = args != null && args.getBoolean(0);
                mGeckoRuntime.getStorageController().clearData(StorageController.ClearFlags.ALL);
                break;
            case "clearHistory":
                webView.getSession().purgeHistory();
                break;
        }
        super.receiveCommand(root, commandId, args);
    }
}
