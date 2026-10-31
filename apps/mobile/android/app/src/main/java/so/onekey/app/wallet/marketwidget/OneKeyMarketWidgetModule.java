package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = OneKeyMarketWidgetModule.NAME)
public final class OneKeyMarketWidgetModule extends ReactContextBaseJavaModule {
    static final String NAME = "OneKeyMarketWidget";
    private final ExecutorService editorExecutor = Executors.newSingleThreadExecutor();

    OneKeyMarketWidgetModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public java.util.Map<String, Object> getConstants() {
        return java.util.Collections.singletonMap("stockSupportVersion", 1);
    }

    @ReactMethod
    public void setConfiguration(String json, Promise promise) {
        try {
            if (MarketWidgetStore.setConfiguration(getReactApplicationContext(), json)) {
                MarketWidgetProvider.renderAll(getReactApplicationContext());
                MarketWidgetRefreshService.configurationChanged(getReactApplicationContext());
            }
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("MARKET_WIDGET_CONFIGURATION_FAILED", "Could not update market widgets", error);
        }
    }

    @ReactMethod
    public void getConfiguration(Promise promise) {
        try {
            MarketWidgetData.Configuration configuration = MarketWidgetStore.configuration(getReactApplicationContext());
            if (!configuration.valid) throw new IllegalStateException("Invalid widget configuration");
            promise.resolve(configuration.json());
        } catch (Exception error) {
            promise.reject("MARKET_WIDGET_CONFIGURATION_FAILED", "Could not read market widget configuration", error);
        }
    }

    @ReactMethod
    public void getWidgetEditorState(String token, Promise promise) {
        try {
            MarketWidgetEditorSession session = MarketWidgetEditorSession.requireActive(getReactApplicationContext(), token);
            promise.resolve(MarketWidgetStore.editorState(getReactApplicationContext(), session.widgetId,
                session.single, session.source).toString());
        } catch (Exception error) {
            promise.reject("MARKET_WIDGET_EDITOR_FAILED", "Could not open widget settings", error);
        }
    }

    @ReactMethod
    public void refreshWidgetEditorState(String token, Promise promise) {
        editorExecutor.execute(() -> {
            try {
                MarketWidgetEditorSession session = MarketWidgetEditorSession.requireActive(getReactApplicationContext(), token);
                if (MarketWidgetStore.canDisplay(getReactApplicationContext())
                    && System.currentTimeMillis() - MarketWidgetStore.hotUpdatedAt(getReactApplicationContext()) >= 5 * 60_000) {
                    try {
                        MarketWidgetStore.saveHot(getReactApplicationContext(),
                            MarketWidgetClient.fetchHot(MarketWidgetStore.configuration(getReactApplicationContext()).locale),
                            System.currentTimeMillis());
                    } catch (Exception ignored) {
                        // Keep cached candidates available if the metadata refresh is offline.
                    }
                }
                List<MarketWidgetData.Asset> candidates = MarketWidgetStore.availableAssets(getReactApplicationContext());
                candidates.addAll(MarketWidgetStore.assets(getReactApplicationContext(), session.widgetId, session.single));
                Set<String> seen = new HashSet<>();
                List<CompletableFuture<Void>> pending = new ArrayList<>();
                for (MarketWidgetData.Asset asset : candidates) {
                    if (!seen.add(asset.key())) continue;
                    MarketWidgetData.Quote cached = MarketWidgetStore.quote(getReactApplicationContext(), asset);
                    if (cached != null && (!cached.symbol.isEmpty() && !cached.name.isEmpty()
                        || System.currentTimeMillis() - cached.fetchedAt < 5 * 60_000)) continue;
                    if (!asset.symbol.isEmpty() && !asset.name.isEmpty()) continue;
                    pending.add(CompletableFuture.runAsync(() -> {
                        try {
                            MarketWidgetEditorSession.requireActive(getReactApplicationContext(), token);
                            if (!MarketWidgetStore.contains(getReactApplicationContext(), asset)) return;
                            MarketWidgetStore.saveQuote(getReactApplicationContext(), asset,
                                MarketWidgetClient.fetch(asset, MarketWidgetStore.configuration(getReactApplicationContext()).locale));
                        } catch (Exception ignored) {
                            // Missing metadata must not block cached selections or change their identity.
                        }
                    }));
                    if (pending.size() == 4) {
                        CompletableFuture.allOf(pending.toArray(new CompletableFuture<?>[0])).join();
                        pending.clear();
                    }
                }
                CompletableFuture.allOf(pending.toArray(new CompletableFuture<?>[0])).join();
                getWidgetEditorState(token, promise);
            } catch (Exception error) {
                promise.reject("MARKET_WIDGET_EDITOR_FAILED", "Could not refresh widget settings", error);
            }
        });
    }

    @ReactMethod
    public void saveWidgetSettings(String token, String raw, Promise promise) {
        try {
            synchronized (MarketWidgetEditorSession.class) {
                MarketWidgetEditorSession session = MarketWidgetEditorSession.requireActive(getReactApplicationContext(), token);
                String saved = MarketWidgetStore.saveSettings(getReactApplicationContext(), session.widgetId,
                    session.single, raw).toString();
                MarketWidgetEditorSession.markSaved(getReactApplicationContext(), token);
                MarketWidgetProvider.render(getReactApplicationContext(), session.widgetId);
                MarketWidgetRefreshService.configurationChanged(getReactApplicationContext());
                promise.resolve(saved);
            }
        } catch (Exception error) {
            promise.reject("MARKET_WIDGET_SAVE_FAILED", "Could not save widget settings", error);
        }
    }

    @ReactMethod
    public void finishWidgetEditing(String token, boolean saved, Promise promise) {
        getReactApplicationContext().runOnUiQueueThread(() -> {
            try {
                MarketWidgetEditorSession.complete(getReactApplicationContext(), token, saved);
                Activity activity = getReactApplicationContext().getCurrentActivity();
                if (activity != null && !activity.isFinishing()) activity.moveTaskToBack(true);
                promise.resolve(null);
            } catch (Exception error) {
                promise.reject("MARKET_WIDGET_EDITOR_FAILED", "Could not finish widget settings", error);
            }
        });
    }

    @Override public void invalidate() {
        editorExecutor.shutdownNow();
        super.invalidate();
    }

    @ReactMethod
    public void requestPinWidget(String kind, Promise promise) {
        if (!"single".equals(kind) && !"watchlist".equals(kind)) {
            promise.reject("MARKET_WIDGET_INVALID_KIND", "Unsupported market widget kind");
            return;
        }
        getReactApplicationContext().runOnUiQueueThread(() -> {
            try {
                Activity activity = getReactApplicationContext().getCurrentActivity();
                AppWidgetManager manager = AppWidgetManager.getInstance(getReactApplicationContext());
                if (activity == null || activity.isFinishing() || !manager.isRequestPinAppWidgetSupported()) {
                    promise.resolve(false);
                    return;
                }
                ComponentName provider = new ComponentName(getReactApplicationContext(), "single".equals(kind)
                    ? MarketSingleWidgetProvider.class : MarketWatchlistWidgetProvider.class);
                // A true result means the launcher accepted the request, not that the user added it.
                promise.resolve(manager.requestPinAppWidget(provider, null, null));
            } catch (Exception error) {
                promise.reject("MARKET_WIDGET_PIN_FAILED", "Could not open the widget picker", error);
            }
        });
    }
}
