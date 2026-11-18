package so.onekey.app.wallet;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import com.tencent.mmkv.MMKV;

import org.json.JSONException;
import org.json.JSONObject;

import so.onekey.app.wallet.travelmode.OneKeyTravelModeSplashScreen;

public class MainLauncherActivity extends Activity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    OneKeyTravelModeSplashScreen.configureLaunch(this);
    super.onCreate(savedInstanceState);

    boolean shouldEnterRecovery = MainApplication.shouldShowRecovery;
    if (!MainActivity.hasCreatedInstance()) {
      SharedPreferences prefs = getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE);
      int windowedFailures = BootRecoveryStore.recordBootAttempt(prefs);
      boolean isHarnessMode = new java.io.File(getFilesDir(), "harness_mode").exists();
      String activeOtaVersion = BundleUpdateStoreAndroid.INSTANCE.getCurrentBundleVersion(this);
      if (!isHarnessMode
          && activeOtaVersion != null
          && !activeOtaVersion.isEmpty()
          && windowedFailures >= BootRecoveryKeys.RECOVERY_THRESHOLD) {
        boolean recordedFailedTarget = false;
        try {
          String prefix = BuildConfig.VERSION_NAME + "-";
          if (activeOtaVersion.startsWith(prefix) && activeOtaVersion.length() > prefix.length()) {
            String failedBundleVersion = activeOtaVersion.substring(prefix.length());
            MMKV settings = MMKV.mmkvWithID("onekey-app-setting");
            JSONObject failedTarget = new JSONObject()
              .put("appVersion", BuildConfig.VERSION_NAME)
              .put("bundleVersion", failedBundleVersion);
            recordedFailedTarget = settings != null
              && settings.encode("onekey_failed_ota_bundle", failedTarget.toString());
            if (recordedFailedTarget) {
              String pendingJson = settings.decodeString("onekey_pending_install_task");
              if (pendingJson != null) {
                JSONObject task = null;
                try {
                  task = new JSONObject(pendingJson);
                } catch (JSONException error) {
                  // An unreadable task cannot be executed and must not block rollback.
                  settings.removeValueForKey("onekey_pending_install_task");
                }
                JSONObject payload = task != null ? task.optJSONObject("payload") : null;
                if (task != null
                    && "pending".equals(task.opt("status"))
                    && "jsbundle-switch".equals(task.opt("type"))
                    && "switch-bundle".equals(task.opt("action"))
                    && BuildConfig.VERSION_NAME.equals(task.opt("targetAppVersion"))
                    && failedBundleVersion.equals(task.opt("targetBundleVersion"))
                    && payload != null
                    && BuildConfig.VERSION_NAME.equals(payload.opt("appVersion"))
                    && failedBundleVersion.equals(payload.opt("bundleVersion"))) {
                  settings.removeValueForKey("onekey_pending_install_task");
                }
              }
              settings.sync();
            }
          }
        } catch (Exception error) {
          recordedFailedTarget = false;
          OneKeyLog.error("BootRecovery", "Failed to persist OTA rollback state");
        }
        // Keep recovery available unless the rollback state is durable.
        if (recordedFailedTarget) {
          BundleUpdateStoreAndroid.INSTANCE.clearUpdateBundleData(this);
          BootRecoveryStore.reset(prefs);
          windowedFailures = 0;
          shouldEnterRecovery = false;
          OneKeyLog.info(
            "BootRecovery",
            "Rolled back active OTA bundle (" + activeOtaVersion
              + ") after consecutive boot failures; continuing normal boot with built-in bundle"
          );
        }
      }
      shouldEnterRecovery = shouldEnterRecovery
        || windowedFailures >= BootRecoveryKeys.RECOVERY_THRESHOLD;
    }

    if (shouldEnterRecovery) {
      startActivity(new Intent(this, RecoveryActivity.class));
    } else {
      Intent mainIntent = new Intent(getIntent());
      mainIntent.setClass(this, MainActivity.class);
      startActivity(mainIntent);
    }
    finish();
  }
}
