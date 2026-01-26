package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Debug;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

/**
 * PerfMemoryModule
 *
 * Exposes process memory usage to JS for performance monitoring.
 * Prefer VmRSS from /proc for the "rss" field (bytes). When unavailable, fallback
 * to totalPss (KB -> bytes) as an approximation.
 */
public class PerfMemoryModule extends ReactContextBaseJavaModule {

    public PerfMemoryModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "PerfMemoryModule";
    }

    private static Long readVmRssBytesFromProcStatus() {
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/self/status"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("VmRSS:")) {
                    continue;
                }
                // Example: "VmRSS:\t  123456 kB"
                String[] parts = line.trim().split("\\s+");
                if (parts.length < 2) {
                    return null;
                }
                long kb = Long.parseLong(parts[1]);
                return kb * 1024L;
            }
        } catch (IOException | NumberFormatException ignored) {
            // ignore
        }
        return null;
    }

    @ReactMethod
    public void getMemoryUsage(Promise promise) {
        try {
            Long rssBytes = readVmRssBytesFromProcStatus();

            ActivityManager am = (ActivityManager) getReactApplicationContext()
                    .getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) {
                if (rssBytes != null) {
                    WritableMap map = Arguments.createMap();
                    map.putDouble("rss", (double) rssBytes);
                    promise.resolve(map);
                } else {
                    promise.resolve(null);
                }
                return;
            }

            int pid = android.os.Process.myPid();
            Debug.MemoryInfo[] memInfos = am.getProcessMemoryInfo(new int[]{pid});
            if (memInfos == null || memInfos.length == 0) {
                if (rssBytes != null) {
                    WritableMap map = Arguments.createMap();
                    map.putDouble("rss", (double) rssBytes);
                    promise.resolve(map);
                } else {
                    promise.resolve(null);
                }
                return;
            }

            // totalPss is in KB.
            long pssBytes = ((long) memInfos[0].getTotalPss()) * 1024L;

            WritableMap map = Arguments.createMap();
            map.putDouble("rss", (double) (rssBytes != null ? rssBytes : pssBytes));
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("PERF_MEMORY_ERROR", e);
        }
    }
}
