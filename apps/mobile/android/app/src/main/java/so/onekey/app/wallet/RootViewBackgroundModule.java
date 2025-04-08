package so.onekey.app.wallet;

import android.app.Activity;
import android.graphics.Color;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.text.SimpleDateFormat;
import java.util.Date;

public class RootViewBackgroundModule extends ReactContextBaseJavaModule {
    private FileLoggerModule fileLogger;

    public RootViewBackgroundModule(ReactApplicationContext context) {
        super(context);
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    @Override
    public String getName() {
        return "RootViewBackground";
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => RootViewBackground:" + name + ": " + msg);
    }

    @ReactMethod
    public void setBackground(Double r, Double g, Double b, Double a) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            return;
        }
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                android.view.View rootView = activity.getWindow().getDecorView();
                int parsedColor = Color.argb(a.intValue(), r.intValue(), g.intValue(), b.intValue());
                rootView.getRootView().setBackgroundColor(parsedColor);
                log("setRootViewBackground", "rgba(" + r + ", " + g + ", " + b + ", " + a + ")");
            }
        });
    }
}
