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

    @Test public void externalHostFixturesRequireTheTestSignature() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        android.content.pm.PackageManager manager = context.getPackageManager();
        String permission = "so.onekey.app.wallet.test.permission.WIDGET_HOST";
        assertEquals(android.content.pm.PermissionInfo.PROTECTION_SIGNATURE,
            manager.getPermissionInfo(permission, 0).protectionLevel);
        assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(permission));
        for (Class<?> activity : new Class<?>[] {WidgetResultHostActivity.class, WidgetResultHostActivity.Editor.class}) {
            android.content.pm.ActivityInfo info = manager.getActivityInfo(new ComponentName(
                instrumentation.getContext().getPackageName(), activity.getName()), 0);
            assertTrue(info.exported);
            assertEquals(permission, info.permission);
        }
    }

    @Test public void draftSlotsSurviveSearchEvictionAndAreDiscardedOnFinish() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        AppWidgetHost host = new AppWidgetHost(context, 831722);
        int widgetId = host.allocateAppWidgetId();
        String token = null;
        try {
            instrumentation.getUiAutomation().adoptShellPermissionIdentity("android.permission.BIND_APPWIDGET");
            assertTrue(AppWidgetManager.getInstance(context).bindAppWidgetIdIfAllowed(widgetId,
                new ComponentName(context, MarketWatchlistWidgetProvider.class)));
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[],\"locale\":\"en-US\"}");
            MarketWidgetStore.saveHot(context, MarketWidgetData.defaults().assets, System.currentTimeMillis());
            token = MarketWidgetEditorSession.create(context, widgetId, false, "hot");
            MarketWidgetData.Asset qqq = stock("QQQ"), apple = stock("AAPL");
            MarketWidgetEditorSession.cacheSearchAssets(context, token, java.util.Collections.singletonList(qqq));
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(qqq.json()), new JSONArray()));
            java.util.List<MarketWidgetData.Asset> later = new java.util.ArrayList<>();
            for (int index = 0; index < 120; index++) later.add(stock("S" + index));
            MarketWidgetEditorSession.cacheSearchAssets(context, token, later);
            MarketWidgetEditorSession session = MarketWidgetEditorSession.requireActive(context, token);
            assertEquals(100, session.searchAssets.size());
            assertFalse(session.searchAssets.stream().anyMatch(asset -> asset.key().equals(qqq.key())));
            assertTrue(session.trustedAssets().stream().anyMatch(asset -> asset.key().equals(qqq.key())));
            assertFalse(MarketWidgetStore.assets(context, widgetId, false).stream().anyMatch(asset -> asset.key().equals(qqq.key())));
            MarketWidgetEditorSession.cacheSearchAssets(context, token, java.util.Collections.singletonList(apple));
            JSONArray slots = new JSONArray().put(qqq.json()).put(apple.json()).put(MarketWidgetData.defaults().assets.get(0).json());
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(slots, new JSONArray()));
            session = MarketWidgetEditorSession.requireActive(context, token);
            MarketWidgetStore.saveSettings(context, widgetId, false, new JSONObject()
                .put("kind", "list").put("source", "hot").put("assets", slots).toString(), session.trustedAssets());
            assertEquals("QQQ", MarketWidgetStore.assets(context, widgetId, false).get(0).stockId);
            assertEquals("AAPL", MarketWidgetStore.assets(context, widgetId, false).get(1).stockId);
            try {
                MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(stock("FORGED").json()), new JSONArray()));
                fail("A draft must reject stock identities supplied only by JS");
            } catch (IllegalArgumentException expected) { }
            MarketWidgetEditorSession.markSaved(context, token);
            MarketWidgetEditorSession.complete(context, token, true);
            assertTrue(MarketWidgetEditorSession.read(context, token).trustedAssets().isEmpty());
            MarketWidgetEditorSession.remove(context, token);
            token = MarketWidgetEditorSession.create(context, widgetId, false, "hot");
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(qqq.json()), new JSONArray()));
            MarketWidgetEditorSession.complete(context, token, false);
            assertTrue(MarketWidgetEditorSession.read(context, token).trustedAssets().isEmpty());
        } finally {
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            MarketWidgetEditorSession.remove(context, token);
            MarketWidgetStore.deleteWidget(context, widgetId);
            host.deleteHost();
        }
    }

    @Test public void canceledReplacementKeepsTheVisibleSelectionSaveable() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        AppWidgetHost host = new AppWidgetHost(context, 831723);
        int widgetId = host.allocateAppWidgetId();
        String token = null;
        try {
            instrumentation.getUiAutomation().adoptShellPermissionIdentity("android.permission.BIND_APPWIDGET");
            assertTrue(AppWidgetManager.getInstance(context).bindAppWidgetIdIfAllowed(widgetId,
                new ComponentName(context, MarketSingleWidgetProvider.class)));
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[],\"locale\":\"en-US\"}");
            MarketWidgetStore.saveHot(context, MarketWidgetData.defaults().assets, System.currentTimeMillis());
            token = MarketWidgetEditorSession.create(context, widgetId, true, "hot");
            MarketWidgetData.Asset qqq = stock("QQQ"), apple = stock("AAPL");
            MarketWidgetEditorSession.cacheSearchAssets(context, token, java.util.Collections.singletonList(qqq));
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(qqq.json()), new JSONArray()));
            MarketWidgetEditorSession.cacheSearchAssets(context, token, java.util.Collections.singletonList(apple));
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(apple.json()), new JSONArray().put(qqq.json())));
            java.util.List<MarketWidgetData.Asset> later = new java.util.ArrayList<>();
            for (int index = 0; index < 120; index++) later.add(stock("C" + index));
            MarketWidgetEditorSession.cacheSearchAssets(context, token, later);
            MarketWidgetEditorSession session = MarketWidgetEditorSession.requireActive(context, token);
            assertEquals(2, session.draftAssets.size());
            assertFalse(session.searchAssets.stream().anyMatch(asset -> asset.key().equals(qqq.key()) || asset.key().equals(apple.key())));
            MarketWidgetStore.saveSettings(context, widgetId, true, new JSONObject()
                .put("kind", "single").put("source", "hot").put("asset", qqq.json()).put("assets", new JSONArray().put(qqq.json())).toString(), session.trustedAssets());
            assertEquals("QQQ", MarketWidgetStore.assets(context, widgetId, true).get(0).stockId);
            MarketWidgetData.Asset bitcoin = MarketWidgetData.defaults().assets.get(0);
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(bitcoin.json()), new JSONArray().put(qqq.json())));
            session = MarketWidgetEditorSession.requireActive(context, token);
            assertEquals(2, session.draftAssets.size());
            assertFalse(session.trustedAssets().stream().anyMatch(asset -> asset.key().equals(apple.key())));
            MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(bitcoin.json()), new JSONArray().put(stock("FORGED").json())));
            assertFalse(MarketWidgetEditorSession.requireActive(context, token).trustedAssets().stream().anyMatch(asset -> "FORGED".equals(asset.stockId)));
            try {
                MarketWidgetEditorSession.retainDraft(context, token, draftRequest(new JSONArray().put(apple.json()), new JSONArray().put(qqq.json())));
                fail("An abandoned proposal must lose its trust when the next choice prunes it");
            } catch (IllegalArgumentException expected) { }
        } finally {
            instrumentation.getUiAutomation().dropShellPermissionIdentity();
            MarketWidgetEditorSession.remove(context, token);
            MarketWidgetStore.deleteWidget(context, widgetId);
            host.deleteHost();
        }
    }

    private static String draftRequest(JSONArray assets, JSONArray visible) throws Exception {
        return new JSONObject().put("assets", assets).put("visibleAssets", visible).toString();
    }

    private static MarketWidgetData.Asset stock(String id) throws Exception {
        return new MarketWidgetData.Asset(new JSONObject().put("kind", "stock").put("stockId", id)
            .put("symbol", id).put("name", "Stock " + id));
    }

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
