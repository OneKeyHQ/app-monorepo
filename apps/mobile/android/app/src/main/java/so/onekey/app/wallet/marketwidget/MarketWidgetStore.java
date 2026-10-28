package so.onekey.app.wallet.marketwidget;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class MarketWidgetStore {
    private static final String NAME = "onekey_public_market_widgets_v1";
    private static final String CONFIGURATION = "configuration";

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static synchronized MarketWidgetData.Configuration configuration(Context context) {
        String raw = preferences(context).getString(CONFIGURATION, null);
        if (raw == null) return MarketWidgetData.defaults();
        try {
            return new MarketWidgetData.Configuration(raw);
        } catch (Exception ignored) {
            // An invalid saved configuration must not silently substitute another watchlist.
            return MarketWidgetData.Configuration.invalid();
        }
    }

    static synchronized void setConfiguration(Context context, String raw) throws org.json.JSONException {
        MarketWidgetData.Configuration configuration = new MarketWidgetData.Configuration(raw);
        if (!preferences(context).edit().putString(CONFIGURATION, configuration.json()).commit()) {
            throw new IllegalStateException("Could not persist widget configuration");
        }
        java.util.Set<String> active = new java.util.HashSet<>();
        for (MarketWidgetData.Asset asset : availableAssets(context)) active.add(asset.key());
        SharedPreferences.Editor editor = preferences(context).edit();
        for (String key : preferences(context).getAll().keySet()) {
            if ((key.startsWith("quote_") && !active.contains(key.substring(6)))
                || (key.startsWith("failed_") && !active.contains(key.substring(7)))) editor.remove(key);
        }
        editor.apply();
    }

    static Context localized(Context context) {
        Configuration configuration = new Configuration(context.getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(configuration(context).locale));
        return context.createConfigurationContext(configuration);
    }

    static synchronized void select(Context context, int widgetId, String assetKey) {
        boolean available = false;
        for (MarketWidgetData.Asset asset : availableAssets(context)) {
            if (asset.key().equals(assetKey)) available = true;
        }
        if (!available) throw new IllegalArgumentException("Widget asset is no longer available");
        if (!preferences(context).edit().putString("selection_" + widgetId, assetKey).commit()) {
            throw new IllegalStateException("Could not persist widget selection");
        }
    }

    static synchronized List<MarketWidgetData.Asset> assets(Context context, int widgetId, boolean single) {
        List<MarketWidgetData.Asset> assets = availableAssets(context);
        if (!single) return new ArrayList<>(assets.subList(0, Math.min(3, assets.size())));
        String selection = preferences(context).getString("selection_" + widgetId, "");
        List<MarketWidgetData.Asset> result = new ArrayList<>();
        for (MarketWidgetData.Asset asset : assets) {
            if (asset.key().equals(selection)) {
                result.add(asset);
                return result;
            }
        }
        // A removed selection becomes empty rather than unexpectedly showing another asset.
        if (selection.isEmpty() && !assets.isEmpty()) result.add(assets.get(0));
        return result;
    }

    static List<MarketWidgetData.Asset> availableAssets(Context context) {
        MarketWidgetData.Configuration configuration = configuration(context);
        if (!configuration.valid) return new ArrayList<>();
        return configuration.assets.isEmpty() ? MarketWidgetData.defaults().assets : configuration.assets;
    }

    static synchronized MarketWidgetData.Quote quote(Context context, MarketWidgetData.Asset asset) {
        return MarketWidgetData.Quote.cached(preferences(context).getString("quote_" + asset.key(), ""));
    }

    static synchronized boolean failed(Context context, MarketWidgetData.Asset asset) {
        return preferences(context).getBoolean("failed_" + asset.key(), false);
    }

    static synchronized void saveQuote(Context context, MarketWidgetData.Asset asset, MarketWidgetData.Quote quote)
        throws org.json.JSONException {
        boolean stillSelected = false;
        for (MarketWidgetData.Asset current : availableAssets(context)) {
            if (current.key().equals(asset.key())) stillSelected = true;
        }
        if (!stillSelected) return;
        if (!preferences(context).edit().putString("quote_" + asset.key(), quote.json().toString())
            .putBoolean("failed_" + asset.key(), false).commit()) {
            throw new IllegalStateException("Could not persist market quote");
        }
    }

    static synchronized void markFailed(Context context, MarketWidgetData.Asset asset) {
        boolean stillSelected = false;
        for (MarketWidgetData.Asset current : availableAssets(context)) {
            if (current.key().equals(asset.key())) stillSelected = true;
        }
        if (!stillSelected) return;
        if (!preferences(context).edit().putBoolean("failed_" + asset.key(), true).commit()) {
            throw new IllegalStateException("Could not persist market update status");
        }
    }

    static synchronized void deleteWidget(Context context, int widgetId) {
        preferences(context).edit().remove("selection_" + widgetId).apply();
    }

    static synchronized void restoreWidget(Context context, int oldId, int newId) {
        String selection = preferences(context).getString("selection_" + oldId, "");
        preferences(context).edit().putString("selection_" + newId, selection)
            .remove("selection_" + oldId).apply();
    }

    private MarketWidgetStore() {}
}
