package so.onekey.app.wallet;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import com.tencent.mmkv.MMKV;

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
            MMKV settings = MMKV.mmkvWithID("onekey-app-setting");
            JSONObject failedTarget = new JSONObject()
              .put("appVersion", BuildConfig.VERSION_NAME)
              .put("bundleVersion", activeOtaVersion.substring(prefix.length()));
            recordedFailedTarget = settings != null
              && settings.encode("onekey_failed_ota_bundle", failedTarget.toString());
            if (recordedFailedTarget) settings.sync();
          }
        } catch (Exception error) {
          OneKeyLog.error("BootRecovery", "Failed to record crashed OTA target");
        }
        // Keep recovery available if the failed target cannot be persisted.
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
