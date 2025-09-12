package so.onekey.app.wallet;

import android.app.Activity;
import android.graphics.Color;

import com.betomorrow.rnfilelogger.FileLoggerModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.text.SimpleDateFormat;
import java.util.Date;

public class ExitModule extends ReactContextBaseJavaModule {
    private FileLoggerModule fileLogger;

    public ExitModule(ReactApplicationContext context) {
        super(context);
        fileLogger = new FileLoggerModule(getReactApplicationContext());
    }

    @Override
    public String getName() {
        return "ExitModule";
    }

    public void log(String name, String msg) {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");
        String currentTime = sdf.format(new Date());
        fileLogger.write(1, currentTime + " | INFO : app => native => RootViewBackground:" + name + ": " + msg);
    }

    @ReactMethod
    public void exitApp() {
        log("exitApp", "");
        android.os.Process.killProcess(android.os.Process.myPid());
    }
}
