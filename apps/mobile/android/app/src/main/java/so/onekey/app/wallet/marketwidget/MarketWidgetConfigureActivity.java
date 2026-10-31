package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Bundle;

import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

import so.onekey.app.wallet.MainLauncherActivity;

/** Keeps the launcher's result contract while the app renders the shared editor. */
public final class MarketWidgetConfigureActivity extends Activity {
    static final String EXTRA_EDIT_EXISTING = "so.onekey.app.wallet.marketwidget.EDIT_EXISTING";

    static final class InitialEditorState {
        final String source;
        final String assetKey;

        InitialEditorState(String source, String assetKey) {
            this.source = source;
            this.assetKey = assetKey;
        }
    }

    static InitialEditorState initialEditorState(Context context, Intent intent, int widgetId, boolean single) {
        // Older rendered cards already use this URI, but do not have the explicit edit extra.
        boolean existing = intent.getBooleanExtra(EXTRA_EDIT_EXISTING, false)
            || Uri.parse("onekey-widget-configure://widget/" + widgetId).equals(intent.getData())
            || MarketWidgetStore.isConfigured(context, widgetId);
        String source = existing ? MarketWidgetStore.source(context, widgetId) : MarketWidgetStore.HOT;
        List<MarketWidgetData.Asset> selected = existing && single
            ? MarketWidgetStore.assets(context, widgetId, true) : new ArrayList<>();
        return new InitialEditorState(source, selected.isEmpty() ? null : selected.get(0).key());
    }

    private String session;
    private boolean leftForEditor;
    private boolean receiverRegistered;
    private final BroadcastReceiver completion = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (session != null && session.equals(intent.getStringExtra(MarketWidgetEditorSession.EXTRA_SESSION))) {
                finishFromSession();
            }
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        int widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        if (!MarketWidgetProvider.owns(this, widgetId)) { finish(); return; }
        try {
            boolean single = MarketWidgetProvider.isSingle(this, widgetId);
            session = state == null ? MarketWidgetEditorSession.create(this, widgetId, single,
                initialEditorState(this, getIntent(), widgetId, single).source) : state.getString("session");
            MarketWidgetEditorSession current = MarketWidgetEditorSession.read(this, session);
            if (current.widgetId != widgetId) { finish(); return; }
            ContextCompat.registerReceiver(this, completion, new IntentFilter(MarketWidgetEditorSession.COMPLETED),
                ContextCompat.RECEIVER_NOT_EXPORTED);
            receiverRegistered = true;
            if (current.result != 0) { finishFromSession(); return; }
            if (state == null) {
                Uri url = new Uri.Builder().scheme("onekey-wallet").authority("market_widget_config")
                    .appendQueryParameter("editorSession", session).build();
                startActivity(new Intent(Intent.ACTION_VIEW, url, this, MainLauncherActivity.class));
            } else {
                leftForEditor = state.getBoolean("leftForEditor", true);
            }
        } catch (Exception ignored) {
            finish();
        }
    }

    private void finishFromSession() {
        try {
            MarketWidgetEditorSession current = MarketWidgetEditorSession.read(this, session);
            if (current.result == 0) return;
            setResult(current.result == 1 ? RESULT_OK : RESULT_CANCELED,
                new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, current.widgetId));
        } catch (Exception ignored) {
            // Missing or invalid sessions remain canceled.
        }
        finish();
    }

    @Override protected void onResume() {
        super.onResume();
        if (!leftForEditor || isFinishing()) return;
        finishFromSession();
        if (!isFinishing()) finish();
    }

    @Override protected void onStop() {
        leftForEditor = true;
        super.onStop();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("session", session);
        state.putBoolean("leftForEditor", leftForEditor);
        super.onSaveInstanceState(state);
    }

    @Override protected void onDestroy() {
        if (receiverRegistered) unregisterReceiver(completion);
        if (isFinishing()) MarketWidgetEditorSession.remove(this, session);
        super.onDestroy();
    }
}
