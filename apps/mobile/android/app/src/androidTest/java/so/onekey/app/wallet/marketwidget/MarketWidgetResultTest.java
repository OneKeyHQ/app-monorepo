package so.onekey.app.wallet.marketwidget;

import static org.junit.Assert.*;

import android.app.Activity;
import android.app.Instrumentation;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import androidx.core.content.ContextCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

@RunWith(AndroidJUnit4.class)
public final class MarketWidgetResultTest {
    @Test public void singleSaveReturnsToTheOriginalTask() throws Exception { returnResult(true, true); }
    @Test public void listSaveReturnsToTheOriginalTask() throws Exception { returnResult(false, true); }
    @Test public void cancellationReturnsToTheOriginalTask() throws Exception { returnResult(true, false); }

    private void returnResult(boolean single, boolean saved) throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        AppWidgetHost host = new AppWidgetHost(context, 831721);
        int widgetId = host.allocateAppWidgetId();
        ArrayBlockingQueue<Intent> results = new ArrayBlockingQueue<>(1);
        ArrayBlockingQueue<Intent> editorReady = new ArrayBlockingQueue<>(1);
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context unused, Intent result) {
                if (WidgetResultHostActivity.EDITOR_ACTION.equals(result.getAction())) editorReady.offer(result);
                else results.offer(result);
            }
        };
        IntentFilter filter = new IntentFilter(WidgetResultHostActivity.RESULT_ACTION);
        filter.addAction(WidgetResultHostActivity.EDITOR_ACTION);
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED);
        Instrumentation.ActivityMonitor editorMonitor = new Instrumentation.ActivityMonitor() {
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent) {
                ComponentName component = intent.getComponent();
                if (component != null && component.getClassName().equals("so.onekey.app.wallet.MainLauncherActivity")) {
                    intent.setComponent(new ComponentName(instrumentation.getContext().getPackageName(),
                        WidgetResultHostActivity.Editor.class.getName()));
                }
                return null;
            }
        };
        instrumentation.addMonitor(editorMonitor);
        Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor(
            MarketWidgetConfigureActivity.class.getName(), null, false);
        try {
            instrumentation.getUiAutomation().adoptShellPermissionIdentity("android.permission.BIND_APPWIDGET");
            assertTrue(AppWidgetManager.getInstance(context).bindAppWidgetIdIfAllowed(widgetId,
                new ComponentName(context, single ? MarketSingleWidgetProvider.class : MarketWatchlistWidgetProvider.class)));
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            context.startActivity(new Intent().setComponent(new ComponentName(
                instrumentation.getContext().getPackageName(), WidgetResultHostActivity.class.getName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            Activity owner = monitor.waitForActivityWithTimeout(15000);
            assertNotNull("The real configuration Activity must start", owner);
            Field sessionField = MarketWidgetConfigureActivity.class.getDeclaredField("session");
            sessionField.setAccessible(true);
            String token = (String) sessionField.get(owner);
            assertNotNull(token);
            if (saved) {
                MarketWidgetData.Configuration defaults = MarketWidgetData.defaults();
                MarketWidgetStore.setConfiguration(context, defaults.json());
                MarketWidgetStore.saveHot(context, defaults.assets, System.currentTimeMillis());
                JSONArray assets = new JSONArray();
                for (int index = 0; index < (single ? 1 : 3); index++) assets.put(defaults.assets.get(index).json());
                MarketWidgetStore.saveSettings(context, widgetId, single, new JSONObject()
                    .put("kind", single ? "single" : "list").put("source", "hot").put("assets", assets).toString());
                MarketWidgetEditorSession.markSaved(context, token);
            }
            Intent editor = editorReady.poll(15, TimeUnit.SECONDS);
            assertNotNull("The separate editor task must become foreground", editor);
            assertNotEquals("The editor must be in a different task from its external host", owner.getTaskId(), editor.getIntExtra("taskId", -1));
            assertFalse(owner.isFinishing());
            Field resumedField = MarketWidgetConfigureActivity.class.getDeclaredField("resumed");
            resumedField.setAccessible(true);
            assertFalse("Completion must start while the original owner is paused", resumedField.getBoolean(owner));
            java.util.concurrent.atomic.AtomicBoolean hidden = new java.util.concurrent.atomic.AtomicBoolean();
            java.util.concurrent.atomic.AtomicReference<Activity> editorProbe = new java.util.concurrent.atomic.AtomicReference<>();
            instrumentation.runOnMainSync(() -> editorProbe.set(new Activity() {
                @Override public int getTaskId() { return -123; }
                @Override public boolean moveTaskToBack(boolean nonRoot) {
                    try { assertTrue("Only the foreground result owner may hide the editor", resumedField.getBoolean(owner)); }
                    catch (IllegalAccessException error) { throw new AssertionError(error); }
                    assertFalse(owner.isFinishing());
                    assertTrue(nonRoot);
                    hidden.set(true);
                    return true;
                }
            }));
            instrumentation.runOnMainSync(() -> {
                try { MarketWidgetConfigureActivity.completeEditing(context, token, saved, editorProbe.get()); }
                catch (Exception error) { throw new AssertionError(error); }
            });
            Intent result = results.poll(15, TimeUnit.SECONDS);
            assertNotNull("The external host must receive the configuration result", result);
            assertEquals(saved ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result.getIntExtra("resultCode", 99));
            assertEquals(widgetId, result.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1));
            assertTrue("The app must be hidden before the original owner finishes", hidden.get());
            assertNotNull(editorProbe.get());
            assertEquals("Return must reuse the Activity that owns the original result", 1, monitor.getHits());
        } finally {
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            instrumentation.removeMonitor(monitor);
            instrumentation.removeMonitor(editorMonitor);
            context.unregisterReceiver(receiver);
            host.deleteHost();
        }
    }

}
