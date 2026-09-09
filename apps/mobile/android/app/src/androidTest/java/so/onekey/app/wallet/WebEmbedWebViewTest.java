package so.onekey.app.wallet;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.os.SystemClock;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.Event;
import com.reactnativecommunity.webview.OneKeyWebEmbedUrlPolicy;
import com.reactnativecommunity.webview.RNCWebChromeClient;
import com.reactnativecommunity.webview.RNCWebView;
import com.reactnativecommunity.webview.RNCWebViewClient;
import com.reactnativecommunity.webview.RNCWebViewManagerImpl;
import com.reactnativecommunity.webview.RNCWebViewWrapper;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONTokener;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.Timeout;
import org.junit.runner.RunWith;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipFile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

/**
 * Exercises the installed Release RNCWebView on the device's real WebView provider.
 * Test sinks observe events after production guards; no bridge provenance or policy is mocked.
 * The main and background Hermes heaps remain separate. Test views use the main React context
 * and new Chromium realms, sharing the native process without reading wallet state or cookies.
 */
@RunWith(AndroidJUnit4.class)
public class WebEmbedWebViewTest {
    private static final String TAG = "OneKeyWebEmbedInstrumentation";
    private static final String PREFIX = "onekey-native-webembed-fixture:";
    private static final String OBSERVER = "OneKeyWebEmbedTestObserver";
    private static final String DOCUMENT = OneKeyWebEmbedUrlPolicy.DOCUMENT_URL;
    private static final String ORIGIN = OneKeyWebEmbedUrlPolicy.ORIGIN;
    private static final String HARDENED = "typeof harden === 'function' && Object.isFrozen(Object.prototype)"
            + " && Object.isFrozen(Array.prototype) && Object.isFrozen(Function.prototype)"
            + " && Object.isFrozen(Promise.prototype)";

    @Rule public ActivityTestRule<MainActivity> activity =
            new ActivityTestRule<>(MainActivity.class, false, true);
    @Rule public Timeout deadline = new Timeout(180, TimeUnit.SECONDS);

    private static byte[] read(InputStream input) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = source.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }

    private static String sha256(byte[] bytes) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static String sha256(InputStream input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream source = input) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = source.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        return hex(digest.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) {
            result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        }
        return result.toString();
    }

    private static void ui(Runnable action) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(action);
    }

    private static void await(String description, BooleanSupplier condition) {
        long limit = SystemClock.elapsedRealtime() + 20_000;
        while (!condition.getAsBoolean() && SystemClock.elapsedRealtime() < limit) SystemClock.sleep(25);
        assertTrue(description, condition.getAsBoolean());
    }

    private static String evaluate(RNCWebView view, String source) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        ui(() -> view.evaluateJavascript(source, value -> {
            result.set(value);
            completed.countDown();
        }));
        assertTrue("WebView JavaScript evaluation timed out", completed.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private static void binaryAssets(Activity activity, String directory, List<String> result) throws Exception {
        String[] names = activity.getAssets().list(directory);
        assertNotNull(names);
        for (String name : names) {
            String path = directory + "/" + name;
            if (path.endsWith(".wasm") || path.endsWith(".bin")) result.add(path);
            else {
                String[] children = activity.getAssets().list(path);
                if (children != null && children.length > 0) binaryAssets(activity, path, result);
            }
        }
    }

    private static JSONArray browserAssetResponses(TestView view, Activity activity, String runtimeAsset) throws Exception {
        List<String> assets = new ArrayList<>();
        binaryAssets(activity, "web-embed", assets);
        assertTrue("The protected APK must include its real binary asset", assets.size() > 0);
        assets.add(0, runtimeAsset);
        JSONArray urls = new JSONArray();
        for (String asset : assets) urls.put(ORIGIN + "/" + asset);
        evaluate(view.webView, "globalThis.__onekeyAssetResponses=null;Promise.all(" + urls
                + ".map(async url=>{const r=await fetch(url);const bytes=await r.arrayBuffer();"
                + "const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))"
                + ".map(n=>n.toString(16).padStart(2,'0')).join('');"
                + "return {status:r.status,mime:r.headers.get('content-type'),length:bytes.byteLength,digest};}))"
                + ".then(value=>{globalThis.__onekeyAssetResponses=JSON.stringify(value);})"
                + ".catch(()=>{globalThis.__onekeyAssetResponses='failed';});");
        long limit = SystemClock.elapsedRealtime() + 15_000;
        String value;
        do {
            value = evaluate(view.webView, "globalThis.__onekeyAssetResponses");
            if (!"null".equals(value)) break;
            SystemClock.sleep(25);
        } while (SystemClock.elapsedRealtime() < limit);
        Object decoded = new JSONTokener(value).nextValue();
        assertTrue("Real WebView asset requests must complete", decoded instanceof String);
        JSONArray responses = new JSONArray((String) decoded);
        assertEquals(assets.size(), responses.length());
        for (int index = 0; index < assets.size(); index++) {
            String asset = assets.get(index);
            byte[] bytes = read(activity.getAssets().open(asset));
            JSONObject response = responses.getJSONObject(index);
            assertEquals(asset, 200, response.getInt("status"));
            assertEquals(asset, bytes.length, response.getInt("length"));
            assertEquals(asset, sha256(bytes), response.getString("digest"));
            String mime = response.getString("mime").split(";", 2)[0];
            if (asset.endsWith(".js")) {
                assertTrue(asset, "application/javascript".equals(mime) || "text/javascript".equals(mime));
            } else assertEquals(asset, asset.endsWith(".wasm") ? "application/wasm" : "application/octet-stream", mime);
        }
        return responses;
    }

    private static boolean knownMessage(String value) {
        return value != null && value.matches(PREFIX + "[a-z-]+");
    }

    private static boolean secureBridgeSupported() throws Exception {
        // WebView's implementation dependency is present in the target APK but is not
        // exported to the app test compile classpath. Invoke the real public AndroidX API.
        return (Boolean) Class.forName("androidx.webkit.WebViewFeature")
                .getMethod("isFeatureSupported", String.class).invoke(null, "WEB_MESSAGE_LISTENER");
    }

    private static void recordNativeProvenance(JSONObject report, ApplicationInfo target) throws Exception {
        ApplicationInfo test = InstrumentationRegistry.getInstrumentation().getContext().getApplicationInfo();
        List<String> testLibraries = new ArrayList<>();
        try (ZipFile apk = new ZipFile(test.sourceDir)) {
            java.util.Enumeration<? extends java.util.zip.ZipEntry> entries = apk.entries();
            while (entries.hasMoreElements()) {
                String name = entries.nextElement().getName();
                if (name.startsWith("lib/") && name.endsWith(".so")) {
                    testLibraries.add(name);
                    assertFalse("The test APK must not ship replacement React/Hermes native libraries",
                            name.matches("lib/[^/]+/lib(?:hermes[^/]*|reactnative|jsi|appmodules|react_codegen_RNCWebViewSpec)\\.so"));
                }
            }
        }
        report.put("testApkSha256", sha256(new FileInputStream(test.sourceDir)));
        report.put("testApkNativeLibraries", new org.json.JSONArray(testLibraries));
        List<String> maps = Files.readAllLines(Paths.get("/proc/self/maps"), StandardCharsets.UTF_8);
        JSONObject libraries = new JSONObject();
        ClassLoader loader = MainActivity.class.getClassLoader();
        for (String name : new String[]{"hermesvm", "reactnative"}) {
            String resolved = (String) loader.getClass().getMethod("findLibrary", String.class).invoke(loader, name);
            assertNotNull("The installed target must resolve its native " + name, resolved);
            boolean fromTarget = resolved.startsWith(target.nativeLibraryDir + "/")
                    || resolved.startsWith(target.sourceDir + "!/");
            assertTrue("Core native libraries must resolve from the actual Release target", fromTarget);
            String mappedPath = resolved.contains("!/") ? resolved.substring(0, resolved.indexOf("!/")) : resolved;
            boolean mapped = false;
            for (String line : maps) {
                if (line.endsWith(" " + mappedPath)) mapped = true;
            }
            assertTrue("The Release native library must actually be mapped: " + name, mapped);
            libraries.put(name, resolved.contains("!/") ? "target-apk-mapped" : "target-native-library-mapped");
        }
        report.put("nativeProvenance", libraries);
    }

    private static void addFrameObserver(WebView view, List<String> frames) {
        try {
            Class<?> listenerType = Class.forName("androidx.webkit.WebViewCompat$WebMessageListener");
            Object listener = Proxy.newProxyInstance(listenerType.getClassLoader(), new Class<?>[]{listenerType},
                    (proxy, method, arguments) -> {
                        if ("onPostMessage".equals(method.getName())) {
                            String message = (String) arguments[1].getClass().getMethod("getData").invoke(arguments[1]);
                            if (knownMessage(message)) {
                                frames.add(message + "|" + arguments[2] + "|" + arguments[3]);
                            }
                            return null;
                        }
                        if ("hashCode".equals(method.getName())) return System.identityHashCode(proxy);
                        if ("equals".equals(method.getName())) return proxy == arguments[0];
                        if ("toString".equals(method.getName())) return OBSERVER;
                        throw new AssertionError("Unexpected AndroidX observer method");
                    });
            Class.forName("androidx.webkit.WebViewCompat")
                    .getMethod("addWebMessageListener", WebView.class, String.class, Set.class, listenerType)
                    .invoke(null, view, OBSERVER, Collections.singleton("*"), listener);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("The installed native WebView observer could not be attached", error);
        }
    }

    private static void removeFrameObserver(WebView view) {
        try {
            Class.forName("androidx.webkit.WebViewCompat")
                    .getMethod("removeWebMessageListener", WebView.class, String.class)
                    .invoke(null, view, OBSERVER);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("The installed native WebView observer could not be removed", error);
        }
    }

    private static final class ObservedWebView extends RNCWebView {
        final List<String> delivered = new CopyOnWriteArrayList<>();
        ObservedWebView(ThemedReactContext context) { super(context); }

        @Override protected void dispatchDirectMessage(WritableMap data) {
            String message = data.getString("data");
            if (knownMessage(message)) delivered.add(message);
        }

        @Override protected void dispatchEvent(WebView view, Event event) {
            // This unattached test React surface has no JS UI event consumer.
        }
    }

    private static final class ObservedClient extends RNCWebViewClient {
        final AtomicInteger errors = new AtomicInteger();
        final AtomicInteger runtimeResponses = new AtomicInteger();
        final AtomicInteger documentRequests = new AtomicInteger();
        final AtomicInteger mappedDocumentResponses = new AtomicInteger();
        final String runtimeUrl;
        final boolean corruptRuntime;
        volatile String responseSha256;

        ObservedClient(String runtimeUrl, boolean corruptRuntime) {
            this.runtimeUrl = runtimeUrl;
            this.corruptRuntime = corruptRuntime;
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            // Always preserve production URL admission. Only the negative test alters an
            // already admitted runtime response, leaving APK bytes and HTML SRI untouched.
            WebResourceResponse response = super.shouldInterceptRequest(view, request);
            if (DOCUMENT.equals(request.getUrl().toString())) {
                documentRequests.incrementAndGet();
                if (response != null) mappedDocumentResponses.incrementAndGet();
            }
            if (response != null && runtimeUrl.equals(request.getUrl().toString())) {
                try {
                    byte[] bytes = read(response.getData());
                    responseSha256 = sha256(bytes);
                    runtimeResponses.incrementAndGet();
                    if (corruptRuntime) {
                        ByteArrayOutputStream corrupt = new ByteArrayOutputStream();
                        corrupt.write(bytes);
                        corrupt.write("\n;globalThis.__onekeySriCorruptionExecuted = true;\n"
                                .getBytes(StandardCharsets.UTF_8));
                        bytes = corrupt.toByteArray();
                    }
                    response.setData(new ByteArrayInputStream(bytes));
                } catch (Exception error) {
                    throw new AssertionError("Could not observe the admitted APK runtime", error);
                }
            }
            return response;
        }

        @Override protected void emitFinishEvent(WebView view, String url) {
            // Observe browser behavior without dispatching UI events into the wallet app.
        }

        @Override public void onReceivedError(WebView view, int code, String description, String url) {
            mLastLoadFailed = true;
            errors.incrementAndGet();
        }

        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                                 WebResourceResponse response) {
            errors.incrementAndGet();
        }
    }

    private static final class ObservedChromeClient extends RNCWebChromeClient {
        final AtomicInteger integrityErrors = new AtomicInteger();
        ObservedChromeClient(RNCWebView view) { super(view); }

        @Override public boolean onConsoleMessage(ConsoleMessage message) {
            String text = message.message();
            if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR
                    && (text.contains("integrity") || text.contains("valid digest"))) {
                integrityErrors.incrementAndGet();
            }
            return true;
        }

        @Override public void onProgressChanged(WebView view, int progress) {
            // Only the stock React progress-event sink is replaced, not browser policy.
        }
    }

    private static final class TestView implements AutoCloseable {
        final ObservedWebView webView;
        final RNCWebViewWrapper wrapper;
        final RNCWebViewManagerImpl manager = new RNCWebViewManagerImpl(true);
        final ObservedClient client;
        final ObservedChromeClient chrome;
        final List<String> frames = new CopyOnWriteArrayList<>();

        TestView(Activity activity, ThemedReactContext context, boolean scoped,
                 String runtimeUrl, boolean corruptRuntime) {
            webView = new ObservedWebView(context);
            wrapper = manager.createViewInstance(context, webView);
            client = new ObservedClient(runtimeUrl, corruptRuntime);
            chrome = new ObservedChromeClient(webView);
            webView.setWebViewClient(client);
            webView.setWebChromeClient(chrome);
            webView.getSettings().setJavaScriptEnabled(true);
            webView.setOneKeyWebEmbedAssets(scoped);
            webView.setMessagingEnabled(true);
            // An independent observer records actual browser-provided provenance. It does
            // not wrap or replace RNCWebView's listener, nor forward messages to the app.
            addFrameObserver(webView, frames);
            activity.addContentView(wrapper, new ViewGroup.LayoutParams(2, 2));
            manager.onAfterUpdateTransaction(wrapper);
        }

        void source(WritableMap value) {
            manager.setSource(wrapper, value);
            manager.onAfterUpdateTransaction(wrapper);
        }

        @Override public void close() {
            ui(() -> {
                removeFrameObserver(webView);
                if (wrapper.getParent() instanceof ViewGroup) {
                    ((ViewGroup) wrapper.getParent()).removeView(wrapper);
                }
                manager.onDropViewInstance(wrapper);
            });
        }
    }

    private TestView create(ThemedReactContext context, boolean scoped, String runtimeUrl,
                            boolean corruptRuntime) {
        AtomicReference<TestView> result = new AtomicReference<>();
        ui(() -> result.set(new TestView(activity.getActivity(), context, scoped, runtimeUrl, corruptRuntime)));
        return result.get();
    }

    private static String post(String name) {
        String message = JSONObject.quote(PREFIX + name);
        return "window.ReactNativeWebView.postMessage(" + message + ");window."
                + OBSERVER + ".postMessage(" + message + ");";
    }

    @Test public void realBrowserEnforcesApkBridgeAndIntegrity() throws Exception {
        JSONObject report = new JSONObject();
        String stage = "release-preflight";
        boolean passed = false;
        try {
            Activity current = activity.getActivity();
            ApplicationInfo application = current.getApplicationInfo();
            assertEquals("Only the actual non-debuggable Release target is accepted", 0,
                    application.flags & ApplicationInfo.FLAG_DEBUGGABLE);
            assertSame("Test APK must use the installed target's RNCWebView class",
                    MainActivity.class.getClassLoader(), RNCWebView.class.getClassLoader());
            assertTrue("This device must genuinely support the secure native bridge",
                    secureBridgeSupported());
            PackageInfo provider = WebView.getCurrentWebViewPackage();
            assertNotNull(provider);
            report.put("provider", provider.packageName + "@" + provider.versionName);
            report.put("targetApkSha256", sha256(new FileInputStream(application.sourceDir)));

            ReactApplication reactApplication = (ReactApplication) current.getApplication();
            AtomicReference<ReactContext> mainContext = new AtomicReference<>();
            await("The real main React context did not become ready", () -> {
                ui(() -> mainContext.set(reactApplication.getReactHost().getCurrentReactContext()));
                return mainContext.get() instanceof ReactApplicationContext;
            });
            recordNativeProvenance(report, application);
            AtomicReference<ThemedReactContext> themed = new AtomicReference<>();
            ui(() -> themed.set(new ThemedReactContext((ReactApplicationContext) mainContext.get(),
                    current, "OneKeyWebEmbedInstrumentation", -1)));
            ThemedReactContext context = themed.get();
            String html = new String(read(current.getAssets().open("web-embed/index.html")), StandardCharsets.UTF_8);
            Matcher runtime = Pattern.compile("<script\\b[^>]*src=[\"']([^\"']*lavamoat-runtime[^\"']+)[\"'][^>]*integrity=[\"']sha(?:256|384|512)-[^\"']+[\"']").matcher(html);
            assertTrue("The APK HTML must retain its protected runtime and SRI", runtime.find());
            String runtimeUrl = java.net.URI.create(DOCUMENT).resolve(runtime.group(1)).toString();
            assertFalse("The APK must have exactly one protected runtime script", runtime.find());
            String runtimeAsset = OneKeyWebEmbedUrlPolicy.getAssetPath(runtimeUrl);
            assertNotNull(runtimeAsset);
            String runtimeHash = sha256(read(current.getAssets().open(runtimeAsset)));
            report.put("indexSha256", sha256(html.getBytes(StandardCharsets.UTF_8)));
            report.put("runtimeSha256", runtimeHash);

            stage = "main-frame-and-iframe";
            try (TestView clean = create(context, true, runtimeUrl, false)) {
                ui(() -> clean.webView.loadUrl(DOCUMENT));
                await("The real APK runtime was not requested", () -> clean.client.runtimeResponses.get() > 0);
                long limit = SystemClock.elapsedRealtime() + 20_000;
                while (!"true".equals(evaluate(clean.webView, HARDENED)) && SystemClock.elapsedRealtime() < limit) {
                    SystemClock.sleep(50);
                }
                assertEquals("The clean APK must execute its real SES runtime", "true", evaluate(clean.webView, HARDENED));
                assertEquals(runtimeHash, clean.client.responseSha256);
                assertEquals(0, clean.chrome.integrityErrors.get());
                report.put("browserAssetResponses", browserAssetResponses(clean, current, runtimeAsset));
                evaluate(clean.webView, post("main-before"));
                await("The real main-frame bridge did not deliver", () -> clean.webView.delivered.contains(PREFIX + "main-before"));
                await("The native browser must report the exact main-frame origin",
                        () -> clean.frames.contains(PREFIX + "main-before|" + ORIGIN + "|true"));

                String frameSource = "window.__onekeyFrameAcks=[];window.addEventListener('message',function(e){"
                        + "if(e.data==='same-attempted'||e.data==='opaque-attempted')window.__onekeyFrameAcks.push(e.data);});";
                for (String name : new String[]{"same", "opaque"}) {
                    String child = "<script>" + post(name + "-iframe")
                            + "parent.postMessage('" + name + "-attempted','*');</script>";
                    frameSource += "{var f=document.createElement('iframe');"
                            + ("opaque".equals(name) ? "f.setAttribute('sandbox','allow-scripts');" : "")
                            + "f.srcdoc=" + JSONObject.quote(child) + ";document.body.appendChild(f);}";
                }
                evaluate(clean.webView, frameSource);
                limit = SystemClock.elapsedRealtime() + 10_000;
                while (!"2".equals(evaluate(clean.webView, "window.__onekeyFrameAcks.length"))
                        && SystemClock.elapsedRealtime() < limit) SystemClock.sleep(25);
                assertEquals("Both real iframe scripts must acknowledge their attempted calls", "2",
                        evaluate(clean.webView, "window.__onekeyFrameAcks.length"));
                await("Same-origin iframe provenance was not observed", () -> clean.frames.contains(PREFIX + "same-iframe|" + ORIGIN + "|false"));
                await("Opaque iframe provenance was not observed", () -> clean.frames.contains(PREFIX + "opaque-iframe|null|false"));
                evaluate(clean.webView, post("main-after"));
                await("The positive bridge must remain live after iframe rejection", () -> clean.webView.delivered.contains(PREFIX + "main-after"));
                SystemClock.sleep(500);
                assertEquals("Iframe messages must never cross the production native guard", 2, clean.webView.delivered.size());
                ui(() -> clean.webView.onMessage(PREFIX + "legacy-spoof", ORIGIN));
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                assertEquals("The legacy public entry cannot manufacture main-frame provenance", 2, clean.webView.delivered.size());
                report.put("mainFrameDelivered", 2).put("iframeAttempts", 2).put("iframeNativeDelivered", 0);
                report.put("actualProvenance", new org.json.JSONArray(clean.frames));

                stage = "source-and-navigation";
                ui(() -> {
                    clean.manager.setAllowFileAccess(clean.wrapper, true);
                    clean.manager.setAllowFileAccessFromFileURLs(clean.wrapper, true);
                    clean.manager.setAllowUniversalAccessFromFileURLs(clean.wrapper, true);
                    WritableMap spoof = Arguments.createMap();
                    spoof.putString("html", "<script>window.__onekeySpoofExecuted=true</script>");
                    spoof.putString("baseUrl", DOCUMENT);
                    clean.source(spoof);
                    clean.webView.loadUrl("https://webembed-instrumentation.invalid/");
                    clean.webView.loadUrl("file:///android_asset/index.android.bundle");
                    clean.webView.loadUrl("content://webembed-instrumentation/private");
                    assertFalse(clean.webView.getSettings().getAllowFileAccess());
                    assertFalse(clean.webView.getSettings().getAllowContentAccess());
                    assertFalse(clean.webView.getSettings().getAllowFileAccessFromFileURLs());
                    assertFalse(clean.webView.getSettings().getAllowUniversalAccessFromFileURLs());
                    assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, clean.webView.getSettings().getMixedContentMode());
                });
                assertEquals(4, clean.client.errors.get());
                assertEquals(DOCUMENT, new JSONTokener(evaluate(clean.webView,
                        "location.origin+location.pathname+location.search")).nextValue());
                assertEquals("false", evaluate(clean.webView, "globalThis.__onekeySpoofExecuted===true"));
                report.put("sourceSpoofAndNavigationDenied", 4);
            }

            stage = "ordinary-view-isolation";
            try (TestView ordinary = create(context, false, runtimeUrl, false)) {
                ui(() -> {
                    assertEquals(null, ordinary.webView.getOneKeyWebEmbedAssetLoader());
                    assertEquals(null, ordinary.client.shouldInterceptRequest(ordinary.webView, DOCUMENT));
                    WritableMap source = Arguments.createMap();
                    source.putString("html", "<!doctype html><script>" + post("ordinary") + "</script>");
                    source.putString("baseUrl", "https://webembed-instrumentation.invalid/");
                    ordinary.source(source);
                });
                await("The ordinary RNCWebView bridge must still work", () -> ordinary.webView.delivered.contains(PREFIX + "ordinary"));
                await("The ordinary native bridge must retain its browser origin",
                        () -> ordinary.frames.contains(PREFIX + "ordinary|https://webembed-instrumentation.invalid|true"));
                assertEquals("false", evaluate(ordinary.webView, "typeof harden==='function'"));
                evaluate(ordinary.webView, "{const controller=new AbortController();"
                        + "setTimeout(()=>controller.abort(),1500);fetch(" + JSONObject.quote(DOCUMENT)
                        + ",{signal:controller.signal}).catch(()=>{});}");
                await("The ordinary browser must actually attempt the reserved asset URL",
                        () -> ordinary.client.documentRequests.get() > 0);
                assertEquals("The production client must not map APK assets for an ordinary view", 0,
                        ordinary.client.mappedDocumentResponses.get());
                report.put("ordinaryBridgeDelivered", true).put("ordinaryApkMapping", false);
            }

            stage = "browser-sri-rejection";
            try (TestView corrupt = create(context, true, runtimeUrl, true)) {
                ui(() -> corrupt.webView.loadUrl(DOCUMENT));
                await("The corruption fixture must reach the real admitted runtime response",
                        () -> corrupt.client.runtimeResponses.get() > 0);
                await("Chromium must report the unchanged HTML integrity mismatch",
                        () -> corrupt.chrome.integrityErrors.get() > 0);
                assertEquals(runtimeHash, corrupt.client.responseSha256);
                assertEquals("false", evaluate(corrupt.webView, "globalThis.__onekeySriCorruptionExecuted===true"));
                assertEquals("false", evaluate(corrupt.webView, HARDENED));
                report.put("sriRejectedMutatedResponse", true).put("mutatedScriptExecuted", false);
            }
            assertEquals("The installed main APK must remain byte-identical", report.getString("targetApkSha256"),
                    sha256(new FileInputStream(application.sourceDir)));
            report.put("unsupportedProviderCoverage", "unit-only; actual provider supports WEB_MESSAGE_LISTENER");
            passed = true;
        } finally {
            report.put("status", passed ? "passed" : "failed");
            report.put("stage", stage);
            Log.i(TAG, report.toString());
        }
    }
}
