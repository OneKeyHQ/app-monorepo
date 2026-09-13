package so.onekey.app.wallet;

import android.content.Context;
import android.util.Base64;
import android.webkit.WebResourceResponse;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.reactnativecommunity.webview.OneKeyWebEmbedAssetLoader;
import com.reactnativecommunity.webview.OneKeyWebEmbedUrlPolicy;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

/** Read-only APK asset checks; no Activity, wallet, authentication, or external request. */
@RunWith(AndroidJUnit4.class)
public class WebEmbedAssetLoaderTest {
    private static byte[] read(InputStream input) throws IOException {
        try (InputStream source = input; ByteArrayOutputStream result = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = source.read(buffer)) != -1) result.write(buffer, 0, count);
            return result.toByteArray();
        }
    }

    @Test
    public void servesExactApkBytesAndNeverFallsBackForReservedPaths() throws IOException {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OneKeyWebEmbedAssetLoader loader = new OneKeyWebEmbedAssetLoader(context, true);
        String url = OneKeyWebEmbedUrlPolicy.DOCUMENT_URL;
        assertTrue(loader.canLoadDocument(url + "#/webembed/api"));
        WebResourceResponse response = loader.intercept(url, "GET", true);
        assertNotNull(response);
        assertEquals("text/html", response.getMimeType());
        assertArrayEquals(read(context.getAssets().open("web-embed/index.html")), read(response.getData()));
        assertEquals("no-store", response.getResponseHeaders().get("Cache-Control"));

        String[] denied = {
            OneKeyWebEmbedUrlPolicy.ORIGIN + "/not-mounted.js",
            OneKeyWebEmbedUrlPolicy.ORIGIN + "/web-embed/%2e%2e/index.android.bundle",
            OneKeyWebEmbedUrlPolicy.ORIGIN + "/web-embed/%",
            OneKeyWebEmbedUrlPolicy.ORIGIN + "/web-embed/__missing_fixture__.js",
            "https://appassets.androidplatform.net.:443/web-embed/index.html",
            "https://%61ppassets.androidplatform.net/web-embed/index.html",
            "file:///android_asset/index.android.bundle",
            "content://example/private-file"
        };
        for (String candidate : denied) {
            WebResourceResponse failure = loader.intercept(candidate, "GET", false);
            assertNotNull(candidate, failure);
            assertEquals(candidate, 404, failure.getStatusCode());
            assertArrayEquals(candidate, new byte[0], read(failure.getData()));
        }
        assertNotNull(loader.intercept(url, "POST", true));
        assertNull(loader.intercept("https://example.test/api", "GET", false));
        assertNotNull(loader.intercept("https://example.test/api", "GET", true));
    }

    private static void listAssets(Context context, String directory, List<String> result) throws IOException {
        String[] names = context.getAssets().list(directory);
        assertNotNull(names);
        for (String name : names) {
            String child = directory + "/" + name;
            String[] children = context.getAssets().list(child);
            assertNotNull(children);
            if (children.length == 0) result.add(child);
            else listAssets(context, child, result);
        }
    }

    @Test
    public void preservesJavaScriptWasmBytesMimeAndDeclaredIntegrity() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OneKeyWebEmbedAssetLoader loader = new OneKeyWebEmbedAssetLoader(context, true);
        List<String> assets = new ArrayList<>();
        listAssets(context, "web-embed", assets);
        int javaScriptCount = 0;
        int wasmCount = 0;
        for (String asset : assets) {
            if (!asset.endsWith(".js") && !asset.endsWith(".wasm") && !asset.endsWith(".bin")) continue;
            WebResourceResponse response = loader.intercept(OneKeyWebEmbedUrlPolicy.ORIGIN + "/" + asset, "GET", false);
            assertNotNull(asset, response);
            // Android's three-argument response constructor leaves Java status unset (0).
            // The real browser's HTTP 200 interpretation is checked by WebEmbedWebViewTest.
            assertEquals(asset, 0, response.getStatusCode());
            assertArrayEquals(asset, read(context.getAssets().open(asset)), read(response.getData()));
            if (asset.endsWith(".js")) {
                javaScriptCount++;
                assertTrue(asset, "application/javascript".equals(response.getMimeType())
                        || "text/javascript".equals(response.getMimeType()));
            } else {
                wasmCount++;
                assertEquals(asset.endsWith(".wasm") ? "application/wasm" : "application/octet-stream", response.getMimeType());
            }
        }
        assertTrue("The APK contains no JavaScript assets", javaScriptCount > 0);
        String html = new String(read(context.getAssets().open("web-embed/index.html")), StandardCharsets.UTF_8);
        Matcher scripts = Pattern.compile("<script\\b([^>]+)>", Pattern.CASE_INSENSITIVE).matcher(html);
        int scriptCount = 0;
        int integrityCount = 0;
        while (scripts.find()) {
            String attributes = scripts.group(1);
            Matcher src = Pattern.compile("\\bsrc=[\"']([^\"']+)[\"']").matcher(attributes);
            if (!src.find()) continue;
            scriptCount++;
            Matcher integrity = Pattern.compile("\\bintegrity=[\"']sha(256|384|512)-([A-Za-z0-9+/=]+)[\"']").matcher(attributes);
            if (!integrity.find()) continue;
            integrityCount++;
            String url = java.net.URI.create(OneKeyWebEmbedUrlPolicy.DOCUMENT_URL).resolve(src.group(1)).toString();
            WebResourceResponse response = loader.intercept(url, "GET", false);
            assertNotNull(response);
            byte[] digest = MessageDigest.getInstance("SHA-" + integrity.group(1)).digest(read(response.getData()));
            assertEquals(integrity.group(2), Base64.encodeToString(digest, Base64.NO_WRAP));
        }
        // Explicit candidate runs require every external script to retain SRI.
        // Ordinary Chromium-67-compatible APKs still exercise the byte/MIME checks.
        if ("true".equals(InstrumentationRegistry.getArguments().getString("onekeyProtectedWebEmbed"))) {
            assertTrue("Protected runtime was not packaged", html.contains("lavamoat-runtime."));
            assertTrue("Protected APK contains no WASM asset", wasmCount > 0);
            assertTrue(scriptCount > 0);
            assertEquals(scriptCount, integrityCount);
        }
    }

    @Test
    public void unsupportedSecureBridgeCannotLoadTheDocument() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OneKeyWebEmbedAssetLoader loader = new OneKeyWebEmbedAssetLoader(context, false);
        assertFalse(loader.canLoadDocument(OneKeyWebEmbedUrlPolicy.DOCUMENT_URL));
        assertFalse(loader.canReceiveMessage(OneKeyWebEmbedUrlPolicy.ORIGIN, true));
        assertNotNull(loader.intercept(OneKeyWebEmbedUrlPolicy.DOCUMENT_URL, "GET", true));
        assertFalse(OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed(OneKeyWebEmbedUrlPolicy.ORIGIN, false));
        assertFalse(OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed("https://example.test", true));
    }
}
