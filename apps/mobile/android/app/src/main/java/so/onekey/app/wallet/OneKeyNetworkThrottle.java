package so.onekey.app.wallet;

import android.content.Context;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.network.OkHttpClientProvider;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Response;

final class OneKeyNetworkThrottle {
  static final String PROFILE_SLOW_4G = "slow4g";
  static final double DEFAULT_LATENCY_MS = 562.5d;

  private static final String TAG = "OneKeyNetworkThrottle";
  private static final AtomicBoolean enabled = new AtomicBoolean(false);
  private static final AtomicLong latencyNanos =
      new AtomicLong((long) (DEFAULT_LATENCY_MS * 1_000_000d));
  private static final AtomicBoolean installed = new AtomicBoolean(false);

  private OneKeyNetworkThrottle() {}

  static void install(Context context) {
    if (!installed.compareAndSet(false, true)) {
      return;
    }
    Context applicationContext = context.getApplicationContext();
    OkHttpClientProvider.setOkHttpClientFactory(
        () -> {
          OkHttpClient.Builder builder =
              OkHttpClientProvider.createClientBuilder(applicationContext);
          builder.addInterceptor(new LatencyInterceptor());
          return builder.build();
        });
    Log.i(TAG, "[onekey-network-throttle] installed RN OkHttp latency interceptor");
  }

  static WritableMap setConfig(ReadableMap config) {
    boolean nextEnabled = config.hasKey("enabled") && config.getBoolean("enabled");
    double nextLatencyMs =
        config.hasKey("latencyMs") ? config.getDouble("latencyMs") : DEFAULT_LATENCY_MS;
    if (nextLatencyMs <= 0) {
      nextLatencyMs = DEFAULT_LATENCY_MS;
    }

    enabled.set(nextEnabled);
    latencyNanos.set((long) (nextLatencyMs * 1_000_000d));
    Log.i(
        TAG,
        "[onekey-network-throttle] native config enabled="
            + nextEnabled
            + " profile="
            + PROFILE_SLOW_4G
            + " latencyMs="
            + nextLatencyMs);
    return getConfig();
  }

  static WritableMap getConfig() {
    WritableMap map = Arguments.createMap();
    map.putBoolean("enabled", enabled.get());
    map.putString("profile", PROFILE_SLOW_4G);
    map.putDouble("latencyMs", latencyNanos.get() / 1_000_000d);
    return map;
  }

  private static long getLatencyNanos() {
    return enabled.get() ? latencyNanos.get() : 0L;
  }

  private static final class LatencyInterceptor implements Interceptor {
    @Override
    public Response intercept(Chain chain) throws IOException {
      long delayNanos = getLatencyNanos();
      if (delayNanos > 0) {
        try {
          long delayMs = TimeUnit.NANOSECONDS.toMillis(delayNanos);
          int remainingNanos = (int) (delayNanos - TimeUnit.MILLISECONDS.toNanos(delayMs));
          Thread.sleep(delayMs, remainingNanos);
        } catch (InterruptedException error) {
          Thread.currentThread().interrupt();
          throw new IOException("Interrupted while applying OneKey network throttle", error);
        }
      }
      return chain.proceed(chain.request());
    }
  }
}
