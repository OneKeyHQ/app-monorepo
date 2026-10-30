package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = OneKeyMarketWidgetModule.NAME)
public final class OneKeyMarketWidgetModule extends ReactContextBaseJavaModule {
    static final String NAME = "OneKeyMarketWidget";

    OneKeyMarketWidgetModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
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
