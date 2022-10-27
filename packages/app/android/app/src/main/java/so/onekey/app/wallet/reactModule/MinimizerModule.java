package so.onekey.app.wallet.reactModule;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import android.app.Activity;
import android.content.Intent;

public class MinimizerModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public MinimizerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "Minimizer";
    }

    // @ReactMethod
    // public void minimize(Boolean shouldCreteIntent, Callback callback) {
    //     // TODO: Implement some actually useful functionality
    //     callback.invoke("Received numberArgument: " + numberArgument + " stringArgument: " + stringArgument);
    // }

    @ReactMethod
    public void exit() {
      Activity activity = reactContext.getCurrentActivity();
      activity.finishAffinity();
      System.exit(0);
    }

    @ReactMethod
    public void goBack() {
      Activity activity = reactContext.getCurrentActivity();
      activity.moveTaskToBack(true);
    }

    @ReactMethod
    public void minimize() {
      Intent startMain = new Intent(Intent.ACTION_MAIN);
      startMain.addCategory(Intent.CATEGORY_HOME);
      startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      this.reactContext.startActivity(startMain);
    }
}
