package so.onekey.app.wallet;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertNotNull;

import android.net.Uri;
import android.webkit.PermissionRequest;

import androidx.test.ext.junit.runners.AndroidJUnit4;

import com.reactnativecommunity.webview.RNCWebChromeClient;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public final class WebViewPermissionRequestTest {
    @Test
    public void protectedMediaIdIsDeniedWithoutRequestingActivityPermissionWhenDisabled() {
        RNCWebChromeClient client = new RNCWebChromeClient(null);
        AtomicReference<String[]> grantedResources = new AtomicReference<>();

        PermissionRequest request = new PermissionRequest() {
            @Override
            public Uri getOrigin() {
                return Uri.parse("https://dapp.example.com");
            }

            @Override
            public String[] getResources() {
                return new String[]{PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID};
            }

            @Override
            public void grant(String[] resources) {
                grantedResources.set(resources);
            }

            @Override
            public void deny() {
                grantedResources.set(new String[0]);
            }
        };

        client.onPermissionRequest(request);

        assertNotNull(grantedResources.get());
        assertArrayEquals(new String[0], grantedResources.get());
    }
}
