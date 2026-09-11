package so.onekey.app.wallet.webview;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import com.reactnativecommunity.webview.RNCWebViewClient;

import com.reactnativecommunity.webview.RNCWebView;

import java.io.ByteArrayInputStream;
import java.io.File;

/**
 * Serves the local web-embed page from a virtual https origin.
 *
 * file:// pages have an opaque origin, which blocks OPFS and ES module loading.
 * A real origin also stays stable whether the files come from APK assets or a
 * verified hot-update bundle, so browser-side storage survives updates.
 *
 * Only a WebView that OUR OWN JS pointed at this origin (RN `source.uri`) may
 * read from it; any other WebView (the dApp browser included) gets 403, so a
 * hostile page cannot navigate itself here and host our trusted files inside
 * its own bridge.
 *
 * JS counterpart: packages/kit/src/components/WebViewWebEmbed/index.tsx.
 */
public final class WebEmbedLocalOrigin implements RNCWebViewClient.RequestInterceptor {
  public static final String HOST = WebViewAssetLoader.DEFAULT_DOMAIN;
  private static final String ASSET_SUBDIR = "web-embed/";
  private static final String BUNDLE_DIR = "onekey-bundle";

  private static final String ORIGIN_PREFIX = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/";

  private final WebViewAssetLoader loader;

  private WebEmbedLocalOrigin(Context context) {
    Context app = context.getApplicationContext();
    final WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(app);
    loader = new WebViewAssetLoader.Builder()
        .setDomain(HOST)
        // Only the web-embed subtree of APK assets.
        .addPathHandler("/web-embed/", path -> assets.handle(ASSET_SUBDIR + path))
        // Verified hot-update bundles: <filesDir>/onekey-bundle/<version>/web-embed/...
        .addPathHandler("/bundle/", new WebViewAssetLoader.InternalStoragePathHandler(app, new File(app.getFilesDir(), BUNDLE_DIR)))
        .build();
  }

  /** Call once from Application.onCreate of the process that hosts WebViews. */
  public static void install(Context context) {
    RNCWebViewClient.setRequestInterceptor(new WebEmbedLocalOrigin(context));
  }

  @Override
  @Nullable
  public WebResourceResponse intercept(WebView view, WebResourceRequest request) {
    Uri url = request.getUrl();
    if (!HOST.equals(url.getHost())) {
      return null;
    }
    // The host is ours: answer every request on it, so nothing on it can reach
    // the network. https only, so a stray http request cannot open a second
    // origin with its own storage.
    if ("https".equals(url.getScheme()) && isOwnWebEmbedView(view)) {
      WebResourceResponse response = loader.shouldInterceptRequest(url);
      if (response != null) {
        return response;
      }
    }
    WebResourceResponse forbidden = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
    forbidden.setStatusCodeAndReasonPhrase(403, "Forbidden");
    return forbidden;
  }

  private static boolean isOwnWebEmbedView(WebView view) {
    if (!(view instanceof RNCWebView)) {
      return false;
    }
    String sourceUri = ((RNCWebView) view).mRncSourceUri;
    return sourceUri != null && sourceUri.startsWith(ORIGIN_PREFIX);
  }
}
