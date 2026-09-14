package so.onekey.app.wallet;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

public class MainLauncherActivity extends Activity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    boolean shouldEnterRecovery = MainApplication.shouldShowRecovery;
    if (!MainActivity.hasCreatedInstance()) {
      int windowedFailures = BootRecoveryStore.recordBootAttempt(
        getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE)
      );
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
