package so.onekey.app.wallet;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;

import android.content.Intent;
import android.net.Uri;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.facebook.react.ReactActivityDelegate;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class MainActivityIntentTest {
    // Stop at the delegate boundary without creating a React host or dispatching to bg.
    private static final class StopAfterDelegate extends RuntimeException {}

    private static final class IntentProbeActivity extends MainActivity {
        @Override
        protected ReactActivityDelegate createReactActivityDelegate() {
            return new ReactActivityDelegate(this, null) {
                @Override
                public boolean onNewIntent(Intent intent) {
                    assertSame(intent, IntentProbeActivity.this.getIntent());
                    throw new StopAfterDelegate();
                }
            };
        }
    }

    private static void deliver(IntentProbeActivity activity, Intent intent) {
        try {
            activity.onNewIntent(intent);
            fail("The probe must stop before background dispatch");
        } catch (StopAfterDelegate expected) {
            // The real MainActivity.onNewIntent has already stored and forwarded the intent.
        }
    }

    @Test
    public void viewBeforeJsReadinessReplacesTheOriginalLauncherIntent() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            IntentProbeActivity activity = new IntentProbeActivity();
            activity.setIntent(new Intent(Intent.ACTION_MAIN));
            Intent incoming = new Intent(Intent.ACTION_VIEW,
                Uri.parse("onekey-wallet://market_widget?assetId=btc"));

            deliver(activity, incoming);

            assertEquals(Intent.ACTION_VIEW, activity.getIntent().getAction());
            assertEquals(incoming.getData(), activity.getIntent().getData());
        });
    }

    @Test
    public void initialUrlReadsTheLatestViewIntent() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            IntentProbeActivity activity = new IntentProbeActivity();
            Intent first = new Intent(Intent.ACTION_VIEW,
                Uri.parse("onekey-wallet://market_widget?assetId=btc"));
            Intent latest = new Intent(Intent.ACTION_VIEW,
                Uri.parse("onekey-wallet://market_widget?assetId=sol"));

            deliver(activity, first);
            deliver(activity, latest);

            assertEquals(Intent.ACTION_VIEW, activity.getIntent().getAction());
            assertEquals(latest.getData(), activity.getIntent().getData());
        });
    }
}
