package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;

/** External widget host fixture; installed only in the instrumentation APK. */
public final class WidgetResultHostActivity extends Activity {
    static final String RESULT_ACTION = "so.onekey.app.wallet.test.WIDGET_RESULT";
    static final String EDITOR_ACTION = "so.onekey.app.wallet.test.WIDGET_EDITOR_READY";

    /** Replaces only React startup while preserving the separate editor task. */
    public static final class Editor extends Activity {
        @Override protected void onResume() {
            super.onResume();
            sendBroadcast(new Intent(EDITOR_ACTION).setPackage("so.onekey.app.wallet")
                .putExtra("taskId", getTaskId()));
        }
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state == null) {
            startActivityForResult(new Intent().setComponent(new ComponentName("so.onekey.app.wallet",
                "so.onekey.app.wallet.marketwidget.MarketWidgetConfigureActivity"))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                    getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)), 1);
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        sendBroadcast(new Intent(RESULT_ACTION).setPackage("so.onekey.app.wallet")
            .putExtra("resultCode", resultCode).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                data == null ? -1 : data.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)));
        finish();
    }
}
