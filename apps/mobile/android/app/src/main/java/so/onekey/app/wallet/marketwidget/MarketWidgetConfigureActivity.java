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
import java.util.HashMap;
import java.util.Map;
import java.lang.ref.WeakReference;

import so.onekey.app.wallet.MainLauncherActivity;

/** Keeps the launcher's result contract while the app renders the shared editor. */
public final class MarketWidgetConfigureActivity extends Activity {
    static final String EXTRA_EDIT_EXISTING = "so.onekey.app.wallet.marketwidget.EDIT_EXISTING";
    private static final Map<String, WeakReference<Activity>> editors = new HashMap<>();

    static void completeEditing(Context context, String token, boolean saved, Activity editor) throws Exception {
        if (editor != null) editors.put(token, new WeakReference<>(editor));
        try {
            MarketWidgetEditorSession.complete(context, token, saved);
        } catch (Exception error) {
            editors.remove(token);
            throw error;
        }
    }

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
    private boolean resumed;
    private final BroadcastReceiver completion = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (session != null && session.equals(intent.getStringExtra(MarketWidgetEditorSession.EXTRA_SESSION))) {
                if (resumed) finishFromSession();
                else {
                    // Launch from this Activity's token to return to its original task.
                    // Sending the app task behind Home can cancel the launcher's pending result.
                    logLifecycle("activity.return_requested");
                    startActivity(new Intent(MarketWidgetConfigureActivity.this, MarketWidgetConfigureActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP));
                }
            }
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        MarketWidgetLog.initialize(this);
        int widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        MarketWidgetLog.event("activity.create", "widgetId", widgetId, "restored", state != null, "taskId", getTaskId());
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
            if (current.result != 0) { leftForEditor = true; return; }
            if (state == null) {
                Uri url = new Uri.Builder().scheme("onekey-wallet").authority("market_widget_config")
                    .appendQueryParameter("editorSession", session).build();
                logLifecycle("activity.open_editor");
                startActivity(new Intent(Intent.ACTION_VIEW, url, this, MainLauncherActivity.class));
            } else {
                leftForEditor = state.getBoolean("leftForEditor", true);
            }
        } catch (Exception error) {
            MarketWidgetLog.failure("activity.create_failed", error, "sessionRef", MarketWidgetLog.sessionRef(session));
            finish();
        }
    }

    private void finishFromSession() {
        try {
            MarketWidgetEditorSession current = MarketWidgetEditorSession.read(this, session);
            MarketWidgetLog.event("activity.check_completion", "sessionRef", MarketWidgetLog.sessionRef(session), "result", current.result);
            if (current.result == 0) return;
            WeakReference<Activity> reference = editors.remove(session);
            Activity editor = reference == null ? null : reference.get();
            // Hide the app only after the result owner is foreground, so Home cannot cancel it.
            if (editor != null && !editor.isFinishing() && editor.getTaskId() != getTaskId()) {
                boolean moved = editor.moveTaskToBack(true);
                MarketWidgetLog.event("activity.editor_backgrounded", "sessionRef", MarketWidgetLog.sessionRef(session),
                    "editorTaskId", editor.getTaskId(), "taskId", getTaskId(), "resumed", resumed, "moved", moved);
            }
            setResult(current.result == 1 ? RESULT_OK : RESULT_CANCELED,
                new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, current.widgetId));
            MarketWidgetLog.event("activity.result_returned", "sessionRef", MarketWidgetLog.sessionRef(session),
                "widgetId", current.widgetId, "resultCode", current.result == 1 ? RESULT_OK : RESULT_CANCELED,
                "resumed", resumed, "caller", getCallingPackage());
        } catch (Exception error) {
            MarketWidgetLog.failure("activity.completion_failed", error, "sessionRef", MarketWidgetLog.sessionRef(session));
            // Missing or invalid sessions remain canceled.
        }
        finish();
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        logLifecycle("activity.resume");
        if (!leftForEditor || isFinishing()) return;
        finishFromSession();
        if (!isFinishing()) finish();
    }

    @Override protected void onStop() {
        logLifecycle("activity.stop");
        leftForEditor = true;
        super.onStop();
    }

    @Override protected void onPause() {
        resumed = false;
        leftForEditor = true;
        logLifecycle("activity.pause");
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("session", session);
        state.putBoolean("leftForEditor", leftForEditor);
        super.onSaveInstanceState(state);
    }

    @Override protected void onDestroy() {
        logLifecycle("activity.destroy");
        if (receiverRegistered) unregisterReceiver(completion);
        if (isFinishing()) {
            editors.remove(session);
            MarketWidgetEditorSession.remove(this, session);
        }
        super.onDestroy();
    }

    private void logLifecycle(String event) {
        MarketWidgetLog.event(event, "sessionRef", MarketWidgetLog.sessionRef(session), "taskId", getTaskId(),
            "leftForEditor", leftForEditor, "resumed", resumed, "finishing", isFinishing(), "changingConfiguration", isChangingConfigurations());
    }
}
