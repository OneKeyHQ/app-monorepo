package so.onekey.app.wallet;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import so.onekey.app.wallet.travelmode.OneKeyTravelModeSplashScreen;

public final class LauncherAliasActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    OneKeyTravelModeSplashScreen.configureLaunch(this);
    super.onCreate(savedInstanceState);

    // The alias relinquishes task identity to the stable recovery-aware entry
    // so disabling an old icon cannot remove the task during a restart.
    Intent launchIntent = new Intent(getIntent());
    launchIntent.setClass(this, MainLauncherActivity.class);
    startActivity(launchIntent);
    finish();
  }
}
