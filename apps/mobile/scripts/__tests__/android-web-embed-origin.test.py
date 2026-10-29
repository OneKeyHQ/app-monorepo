"""Exercise the real local-origin interceptor on a JVM with Android/loader stubs.

Run: python3 apps/mobile/scripts/__tests__/android-web-embed-origin.test.py
This checks app routing policy, not AndroidX internals or WebView rendering.
"""

from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SOURCES = {
    "androidx/annotation/Nullable.java": "package androidx.annotation; public @interface Nullable {}",
    "android/content/Context.java": """
package android.content;
import java.io.File;
public class Context {
    public final File files, assets;
    public Context(File root) { files = new File(root, "files"); assets = new File(root, "assets"); }
    public Context getApplicationContext() { return this; }
    public File getFilesDir() { return files; }
}
""",
    "android/net/Uri.java": """
package android.net;
public class Uri {
    private final java.net.URI uri;
    public Uri(String value) { uri = java.net.URI.create(value); }
    public String getHost() { return uri.getHost(); }
    public String getScheme() { return uri.getScheme(); }
    public String getPath() { return uri.getPath(); }
}
""",
    "android/webkit/WebView.java": "package android.webkit; public class WebView {}",
    "android/webkit/WebResourceRequest.java": """
package android.webkit;
public interface WebResourceRequest { android.net.Uri getUrl(); }
""",
    "android/webkit/WebResourceResponse.java": """
package android.webkit;
public class WebResourceResponse {
    public final java.io.InputStream data;
    public int status = 200;
    public WebResourceResponse(String mime, String encoding, java.io.InputStream data) { this.data = data; }
    public void setStatusCodeAndReasonPhrase(int status, String reason) { this.status = status; }
}
""",
    "com/reactnativecommunity/webview/RNCWebView.java": """
package com.reactnativecommunity.webview;
public class RNCWebView extends android.webkit.WebView { public String mRncSourceUri; }
""",
    "com/reactnativecommunity/webview/RNCWebViewClient.java": """
package com.reactnativecommunity.webview;
public class RNCWebViewClient {
    public interface RequestInterceptor {
        android.webkit.WebResourceResponse intercept(android.webkit.WebView view, android.webkit.WebResourceRequest request);
    }
    public static RequestInterceptor interceptor;
    public static void setRequestInterceptor(RequestInterceptor value) { interceptor = value; }
}
""",
    "com/margelo/nitro/reactnativebundleupdate/BundleUpdateStoreAndroid.java": """
package com.margelo.nitro.reactnativebundleupdate;
public class BundleUpdateStoreAndroid {
    public static final BundleUpdateStoreAndroid INSTANCE = new BundleUpdateStoreAndroid();
    public String verifiedPath = "";
    public String getWebEmbedPath(android.content.Context context) { return verifiedPath; }
}
""",
    "androidx/webkit/WebViewAssetLoader.java": """
package androidx.webkit;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.util.*;
public class WebViewAssetLoader {
    public static final String DEFAULT_DOMAIN = "appassets.androidplatform.net";
    public interface PathHandler { WebResourceResponse handle(String path); }
    private final Map<String, PathHandler> handlers = new LinkedHashMap<>();
    public static class Builder {
        private final WebViewAssetLoader loader = new WebViewAssetLoader();
        public Builder setDomain(String host) { return this; }
        public Builder addPathHandler(String prefix, PathHandler handler) { loader.handlers.put(prefix, handler); return this; }
        public WebViewAssetLoader build() { return loader; }
    }
    public WebResourceResponse shouldInterceptRequest(Uri uri) {
        for (Map.Entry<String, PathHandler> entry : handlers.entrySet()) {
            if (uri.getPath().startsWith(entry.getKey())) {
                return entry.getValue().handle(uri.getPath().substring(entry.getKey().length()));
            }
        }
        return null;
    }
    public static class InternalStoragePathHandler implements PathHandler {
        private final File root;
        public InternalStoragePathHandler(Context context, File root) { this.root = root; }
        public WebResourceResponse handle(String path) {
            try {
                File file = new File(root, path).getCanonicalFile();
                if (!file.toPath().startsWith(root.getCanonicalFile().toPath()) || !file.isFile()) return null;
                return new WebResourceResponse("text/plain", "utf-8", new FileInputStream(file));
            } catch (IOException error) { return null; }
        }
    }
    public static class AssetsPathHandler extends InternalStoragePathHandler {
        public AssetsPathHandler(Context context) { super(context, context.assets); }
    }
}
""",
    "so/onekey/app/wallet/webview/OriginHarness.java": """
package so.onekey.app.wallet.webview;
import android.content.Context;
import android.net.Uri;
import android.webkit.*;
import com.reactnativecommunity.webview.*;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import java.io.File;
import java.nio.charset.StandardCharsets;
public class OriginHarness {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static WebResourceResponse request(WebView view, String url) {
        return RNCWebViewClient.interceptor.intercept(view, () -> new Uri(url));
    }
    private static void check(boolean result, String message) {
        if (!result) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        Context context = new Context(new File(args[0]));
        File current = new File(context.files, "onekey-bundle/current/web-embed");
        BundleUpdateStoreAndroid.INSTANCE.verifiedPath = current.getAbsolutePath();
        WebEmbedLocalOrigin.install(context);
        RNCWebView own = new RNCWebView();
        own.mRncSourceUri = ORIGIN + "/bundle/current/web-embed/index.html#/prime/purchase";
        String mode = args[1], path = args[2];
        if (mode.equals("unverified") || mode.equals("allow-unverified")) BundleUpdateStoreAndroid.INSTANCE.verifiedPath = "";
        if (mode.equals("other-root")) BundleUpdateStoreAndroid.INSTANCE.verifiedPath = new File(context.files, "other/current/web-embed").getAbsolutePath();
        if (mode.equals("other-version")) BundleUpdateStoreAndroid.INSTANCE.verifiedPath = new File(context.files, "onekey-bundle/old/web-embed").getAbsolutePath();
        if (mode.equals("dapp")) own.mRncSourceUri = "https://example.com";
        WebView view = mode.equals("plain-view") ? new WebView() : own;
        String url = mode.equals("remote") ? "https://example.com/index.html"
            : (mode.equals("http") ? "http" : "https") + "://appassets.androidplatform.net" + path;
        WebResourceResponse response = request(view, url);
        if (mode.equals("remote")) {
            check(response == null, "Remote payment resources must retain their normal loader");
        } else if (mode.equals("allow") || mode.equals("allow-unverified")) {
            check(response != null && response.status == 200, "Expected local resource: " + path);
            check(new String(response.data.readAllBytes(), StandardCharsets.UTF_8).equals("fixture"), "Wrong local file");
        } else {
            check(response != null && response.status == 403, "Must deny locally without network fallback: " + path);
        }
    }
}
""",
}


class AndroidWebEmbedOriginTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="onekey-web-embed-origin-")
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.root = Path(cls.temporary.name)
        for name, source in SOURCES.items():
            target = cls.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(source)
        source = Path(__file__).resolve().parents[2] / "android/app/src/main/java/so/onekey/app/wallet/webview/WebEmbedLocalOrigin.java"
        shutil.copyfile(source, cls.root / "so/onekey/app/wallet/webview/WebEmbedLocalOrigin.java")
        for path in ["assets/web-embed/index.html", "assets/private.txt",
                     "files/onekey-bundle/current/web-embed/index.html",
                     "files/onekey-bundle/current/web-embed/static/worker.js",
                     "files/onekey-bundle/current/web-embed/static/wallet.wasm",
                     "files/onekey-bundle/old/web-embed/index.html",
                     "files/onekey-bundle/current/main.jsbundle.hbc",
                     "files/onekey-bundle/current/background.bundle",
                     "files/onekey-bundle/current/common.bundle",
                     "files/onekey-bundle/current/metadata.json",
                     "files/onekey-bundle/asc/signature.asc"]:
            target = cls.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("fixture")
        cls.classes = cls.root / "classes"
        subprocess.run(["javac", "-d", str(cls.classes), *map(str, cls.root.rglob("*.java"))], check=True)

    def request(self, mode, path):
        result = subprocess.run(["java", "-cp", str(self.classes), "so.onekey.app.wallet.webview.OriginHarness",
                                 str(self.root), mode, path], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_apk_and_verified_current_web_embed_are_available(self):
        for path in ["/web-embed/index.html", "/bundle/current/web-embed/index.html",
                     "/bundle/current/web-embed/static/worker.js", "/bundle/current/web-embed/static/wallet.wasm"]:
            with self.subTest(path=path):
                self.request("allow", path)

    def test_other_bundle_contents_and_versions_are_denied(self):
        for path in ["/bundle/current/main.jsbundle.hbc", "/bundle/current/background.bundle",
                     "/bundle/current/common.bundle", "/bundle/current/metadata.json",
                     "/bundle/asc/signature.asc", "/bundle/old/web-embed/index.html",
                     "/bundle/current/web-embed-other/index.html", "/unmapped/index.html"]:
            with self.subTest(path=path):
                self.request("deny", path)

    def test_verification_and_current_version_are_required(self):
        for mode in ["unverified", "other-root", "other-version"]:
            with self.subTest(mode=mode):
                self.request(mode, "/bundle/current/web-embed/index.html")

    def test_apk_still_loads_without_an_update_bundle(self):
        self.request("allow-unverified", "/web-embed/index.html")
        self.request("unverified", "/bundle/current/web-embed/index.html")

    def test_traversal_is_denied(self):
        for path in ["/web-embed/../private.txt", "/web-embed/%2e%2e/private.txt",
                     "/bundle/current/web-embed/../metadata.json",
                     "/bundle/current/web-embed/%2e%2e/metadata.json",
                     "/bundle/current/web-embed/%5c..%5cmetadata.json"]:
            with self.subTest(path=path):
                self.request("deny", path)

    def test_other_webviews_and_http_are_denied(self):
        for mode in ["dapp", "plain-view", "http"]:
            with self.subTest(mode=mode):
                self.request(mode, "/web-embed/index.html")

    def test_remote_payment_urls_keep_their_normal_loader(self):
        self.request("remote", "/index.html")


if __name__ == "__main__":
    unittest.main(verbosity=2)
