"""Run the real Android launcher on a JVM with platform/storage stubs.

Usage: python3 apps/mobile/scripts/__tests__/android-ota-rollback.test.py \
    --json-jar /path/to/org.json.jar [--java-home /path/to/jdk]
The JSON parser is the real org.json implementation, not a fixture parser.
"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SOURCES = {
    "android/os/Bundle.java": "package android.os; public class Bundle {}",
    "android/content/Intent.java": """
package android.content;
public class Intent {
    public Class<?> target;
    public Intent() {}
    public Intent(Intent other) {}
    public Intent(Object context, Class<?> type) { target = type; }
    public Intent setClass(Object context, Class<?> type) { target = type; return this; }
}
""",
    "android/content/SharedPreferences.java": """
package android.content;
public interface SharedPreferences {
    int getInt(String key, int fallback);
    String getString(String key, String fallback);
    Editor edit();
    interface Editor {
        Editor putInt(String key, int value);
        Editor putString(String key, String value);
        Editor remove(String key);
        boolean commit();
    }
}
""",
    "android/app/Activity.java": """
package android.app;
import android.content.*;
import java.io.File;
public class Activity {
    public static final int MODE_PRIVATE = 0;
    public static SharedPreferences prefs;
    public static File files;
    public Intent launched;
    protected void onCreate(android.os.Bundle state) {}
    public SharedPreferences getSharedPreferences(String name, int mode) { return prefs; }
    public File getFilesDir() { return files; }
    public Intent getIntent() { return new Intent(); }
    public void startActivity(Intent intent) { launched = intent; }
    public void finish() {}
}
""",
    "com/tencent/mmkv/MMKV.java": """
package com.tencent.mmkv;
import java.util.*;
public class MMKV {
    public static final MMKV INSTANCE = new MMKV();
    public static String pending, marker, failure;
    public static final List<String> calls = new ArrayList<>();
    public static MMKV mmkvWithID(String id) {
        if (!"onekey-app-setting".equals(id)) throw new AssertionError(id);
        return "unavailable".equals(failure) ? null : INSTANCE;
    }
    public boolean encode(String key, String value) {
        if (!"onekey_failed_ota_bundle".equals(key)) throw new AssertionError(key);
        if ("write".equals(failure)) return false;
        calls.add("record"); marker = value; return true;
    }
    public String decodeString(String key) {
        if (!"onekey_pending_install_task".equals(key)) throw new AssertionError(key);
        if ("read".equals(failure)) throw new IllegalStateException("fixture");
        return pending;
    }
    public void removeValueForKey(String key) {
        if (!"onekey_pending_install_task".equals(key)) throw new AssertionError(key);
        if ("remove".equals(failure)) throw new IllegalStateException("fixture");
        calls.add("remove"); pending = null;
    }
    public void sync() {
        if ("sync".equals(failure)) throw new IllegalStateException("fixture");
        calls.add("sync");
    }
}
""",
    "com/margelo/nitro/reactnativebundleupdate/BundleUpdateStoreAndroid.java": """
package com.margelo.nitro.reactnativebundleupdate;
import com.tencent.mmkv.MMKV;
public class BundleUpdateStoreAndroid {
    public static final BundleUpdateStoreAndroid INSTANCE = new BundleUpdateStoreAndroid();
    public String version;
    public String getCurrentBundleVersion(Object context) { return version; }
    public void clearUpdateBundleData(Object context) {
        if (!MMKV.calls.contains("sync")) throw new AssertionError("unsynced rollback");
        MMKV.calls.add("clear"); version = null;
    }
}
""",
    "com/margelo/nitro/nativelogger/OneKeyLog.java": """
package com.margelo.nitro.nativelogger;
public class OneKeyLog {
    public static void info(String tag, String message) {}
    public static void error(String tag, String message) {}
}
""",
    "so/onekey/app/wallet/travelmode/OneKeyTravelModeSplashScreen.java": """
package so.onekey.app.wallet.travelmode;
public class OneKeyTravelModeSplashScreen {
    public static void configureLaunch(Object context) {}
}
""",
    "so/onekey/app/wallet/MainApplication.java": """
package so.onekey.app.wallet;
public class MainApplication { public static boolean shouldShowRecovery; }
class MainActivity { static boolean hasCreatedInstance() { return false; } }
class RecoveryActivity {}
class BuildConfig { static final String VERSION_NAME = "6.7.0"; }
""",
    "so/onekey/app/wallet/RollbackHarness.java": """
package so.onekey.app.wallet;
import android.app.Activity;
import android.content.SharedPreferences;
import com.tencent.mmkv.MMKV;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import java.io.File;
import java.util.*;
import org.json.JSONObject;
public class RollbackHarness {
    static class Prefs implements SharedPreferences, SharedPreferences.Editor {
        final Map<String, Object> values = new HashMap<>();
        public int getInt(String key, int fallback) { return (int) values.getOrDefault(key, fallback); }
        public String getString(String key, String fallback) { return (String) values.getOrDefault(key, fallback); }
        public Editor edit() { return this; }
        public Editor putInt(String key, int value) { values.put(key, value); return this; }
        public Editor putString(String key, String value) { values.put(key, value); return this; }
        public Editor remove(String key) { values.remove(key); return this; }
        public boolean commit() { return true; }
    }
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        Activity.prefs = new Prefs();
        Activity.files = new File(args[0]);
        BundleUpdateStoreAndroid store = BundleUpdateStoreAndroid.INSTANCE;
        store.version = "6.7.0-5";
        MMKV.pending = "<absent>".equals(args[1]) ? null : args[1];
        MMKV.failure = args[2];
        BootRecoveryStore.recordBootAttempt(Activity.prefs);
        BootRecoveryStore.recordBootAttempt(Activity.prefs);
        MainLauncherActivity launcher = new MainLauncherActivity();
        launcher.onCreate(null);
        if (!MMKV.failure.isEmpty()) {
            check("6.7.0-5".equals(store.version), "storage failure must retain OTA pointer");
            check(launcher.launched.target == RecoveryActivity.class, "storage failure must open recovery");
            check(!MMKV.calls.contains("clear"), "storage failure must not clear OTA");
        } else {
            check(store.version == null, "third failed boot must clear OTA pointer");
            check(launcher.launched.target == MainActivity.class, "rollback must launch built-in bundle");
            check(BootRecoveryStore.readWindowedCount(Activity.prefs) == 0, "rollback must reset boot history");
            JSONObject marker = new JSONObject(MMKV.marker);
            check("6.7.0".equals(marker.getString("appVersion")), "native app version must be recorded");
            check("5".equals(marker.getString("bundleVersion")), "normalized failed bundle must be recorded");
            boolean remove = "remove".equals(args[3]);
            check(remove ? MMKV.pending == null : Objects.equals(MMKV.pending, "<absent>".equals(args[1]) ? null : args[1]),
                "only corrupt or matching pending tasks may be removed");
            check(MMKV.calls.equals(remove ? Arrays.asList("record", "remove", "sync", "clear")
                : Arrays.asList("record", "sync", "clear")), "rollback state must be durable before pointer clear");
        }
    }
}
""",
}


class AndroidOtaRollbackTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="onekey-ota-rollback-")
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.root = Path(cls.temporary.name)
        source_root = Path(__file__).resolve().parents[2] / "android/app/src/main/java/so/onekey/app/wallet"
        for name, source in SOURCES.items():
            target = cls.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(source)
        for name in ["MainLauncherActivity.java", "BootRecoveryStore.java", "BootRecoveryKeys.java"]:
            shutil.copyfile(source_root / name, cls.root / "so/onekey/app/wallet" / name)
        cls.classes = cls.root / "classes"
        subprocess.run([str(JAVA / "javac"), "-cp", str(JSON_JAR), "-d", str(cls.classes),
                        *map(str, cls.root.rglob("*.java"))], check=True, capture_output=True, text=True)

    def launch(self, pending, failure="", remove=False):
        result = subprocess.run([str(JAVA / "java"), "-cp", os.pathsep.join([str(self.classes), str(JSON_JAR)]),
                                 "so.onekey.app.wallet.RollbackHarness", str(self.root), pending,
                                 failure, "remove" if remove else "preserve"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    @staticmethod
    def task(bundle="5", payload="5", status="pending"):
        import json
        return json.dumps({"status": status, "type": "jsbundle-switch", "action": "switch-bundle",
                           "targetAppVersion": "6.7.0", "targetBundleVersion": bundle,
                           "payload": {"appVersion": "6.7.0", "bundleVersion": payload}})

    def test_corrupt_tasks_are_removed_before_rollback(self):
        for pending in ["", "{broken", "[]", "null", '"string"', "42"]:
            with self.subTest(pending=pending):
                self.launch(pending, remove=True)

    def test_matching_task_is_revoked(self):
        self.launch(self.task(), remove=True)

    def test_unrelated_and_absent_tasks_are_preserved(self):
        for pending in [self.task(bundle="6", payload="6"), self.task(payload="6"),
                        self.task(status="applied_waiting_verify"), "{}", "<absent>"]:
            with self.subTest(pending=pending):
                self.launch(pending)

    def test_storage_failures_keep_native_recovery(self):
        for failure in ["unavailable", "write", "read", "remove", "sync"]:
            with self.subTest(failure=failure):
                self.launch(self.task(), failure=failure)

    def test_corrupt_task_removal_failure_keeps_native_recovery(self):
        self.launch("{broken", failure="remove")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-jar", required=True, type=Path)
    parser.add_argument("--java-home", default=os.environ.get("JAVA_HOME"), type=Path)
    args = parser.parse_args()
    JSON_JAR = args.json_jar.resolve()
    if not JSON_JAR.is_file():
        parser.error("--json-jar must point to a real org.json implementation JAR")
    java_command = shutil.which("javac")
    if not args.java_home and not java_command:
        parser.error("JDK required: set JAVA_HOME or pass --java-home")
    JAVA = args.java_home / "bin" if args.java_home else Path(java_command).parent
    unittest.main(argv=[__file__], verbosity=2)
