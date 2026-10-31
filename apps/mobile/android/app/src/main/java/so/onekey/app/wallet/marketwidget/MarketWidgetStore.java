package so.onekey.app.wallet.marketwidget;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class MarketWidgetStore {
    static final String WATCHLIST = "watchlist";
    static final String HOT = "hot";
    private static final String NAME = "onekey_public_market_widgets_v1";
    private static final String CONFIGURATION = "configuration";

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static void addConfigurationListener(Context context, SharedPreferences.OnSharedPreferenceChangeListener listener) {
        preferences(context).registerOnSharedPreferenceChangeListener(listener);
    }

    static void removeConfigurationListener(Context context, SharedPreferences.OnSharedPreferenceChangeListener listener) {
        preferences(context).unregisterOnSharedPreferenceChangeListener(listener);
    }

    static synchronized MarketWidgetData.Configuration configuration(Context context) {
        String raw = preferences(context).getString(CONFIGURATION, null);
        if (raw == null) return MarketWidgetData.defaults();
        try {
            return new MarketWidgetData.Configuration(raw);
        } catch (Exception ignored) {
            return MarketWidgetData.Configuration.invalid();
        }
    }

    static synchronized boolean canDisplay(Context context) {
        MarketWidgetData.Configuration configuration = configuration(context);
        return configuration.valid && !configuration.privacyMasked;
    }

    static synchronized boolean setConfiguration(Context context, String raw) throws JSONException {
        MarketWidgetData.Configuration configuration = new MarketWidgetData.Configuration(raw);
        if (preferences(context).contains(CONFIGURATION)
            && configuration.sameContent(configuration(context))) return false;
        if (!preferences(context).edit().putString(CONFIGURATION, configuration.json()).commit()) {
            throw new IllegalStateException("Could not persist widget configuration");
        }
        Set<String> active = new HashSet<>();
        for (MarketWidgetData.Asset asset : allAssets(context)) active.add(asset.key());
        SharedPreferences.Editor editor = preferences(context).edit();
        for (String key : preferences(context).getAll().keySet()) {
            if ((key.startsWith("quote_") && !active.contains(key.substring(6)))
                || (key.startsWith("history_") && !active.contains(key.substring(8)))
                || (key.startsWith("failed_") && !active.contains(key.substring(7)))) editor.remove(key);
            if (configuration.privacyMasked && (key.equals("hot_assets") || key.equals("hot_updated"))) editor.remove(key);
        }
        editor.apply();
        return true;
    }

    static Context localized(Context context) {
        Configuration resources = new Configuration(context.getResources().getConfiguration());
        resources.setLocale(Locale.forLanguageTag(configuration(context).locale));
        return context.createConfigurationContext(resources);
    }

    static synchronized String source(Context context, int widgetId) {
        return preferences(context).getString("source_" + widgetId, WATCHLIST);
    }

    static synchronized boolean isConfigured(Context context, int widgetId) {
        return preferences(context).contains("source_" + widgetId)
            || preferences(context).contains("selection_" + widgetId);
    }

    static synchronized void configure(Context context, int widgetId, String source, String assetKey, boolean single) {
        if (!WATCHLIST.equals(source) && !HOT.equals(source)) throw new IllegalArgumentException("Invalid source");
        MarketWidgetData.Asset selected = null;
        for (MarketWidgetData.Asset asset : availableAssets(context, source)) {
            if (asset.key().equals(assetKey)) selected = asset;
        }
        // An existing hot selection remains a stable identity even when its rank changes.
        if (selected == null && HOT.equals(source) && source.equals(source(context, widgetId))) {
            for (MarketWidgetData.Asset asset : assets(context, widgetId, true)) {
                if (asset.key().equals(assetKey)) selected = asset;
            }
        }
        if (!canDisplay(context) || (single && selected == null)) {
            throw new IllegalArgumentException("Widget asset is no longer available");
        }
        try {
            SharedPreferences.Editor editor = preferences(context).edit().putString("source_" + widgetId, source)
                .remove("selection_" + widgetId).remove("selected_hot_" + widgetId).remove("manual_assets_" + widgetId);
            if (single) {
                editor.putString("selection_" + widgetId, selected.key());
                if (HOT.equals(source)) editor.putString("selected_hot_" + widgetId, selected.json().toString());
            }
            if (!editor.commit()) throw new IllegalStateException("Could not persist widget selection");
        } catch (JSONException error) {
            throw new IllegalStateException(error);
        }
    }

    static synchronized void select(Context context, int widgetId, String assetKey) {
        configure(context, widgetId, WATCHLIST, assetKey, true);
    }

    static synchronized List<MarketWidgetData.Asset> assets(Context context, int widgetId, boolean single) {
        List<MarketWidgetData.Asset> result = new ArrayList<>();
        if (!canDisplay(context)) return result;
        if (hasManualSelection(context, widgetId)) {
            try {
                JSONArray values = new JSONArray(preferences(context).getString("manual_assets_" + widgetId, "[]"));
                if (values.length() != (single ? 1 : 3)) return result;
                for (int index = 0; index < values.length(); index++) {
                    result.add(new MarketWidgetData.Asset(values.getJSONObject(index)));
                }
            } catch (JSONException ignored) {
                result.clear();
            }
            return result;
        }
        String source = source(context, widgetId);
        List<MarketWidgetData.Asset> assets = availableAssets(context, source);
        if (!single) return new ArrayList<>(assets.subList(0, Math.min(3, assets.size())));
        String selection = preferences(context).getString("selection_" + widgetId, "");
        if (HOT.equals(source) && !selection.isEmpty()) {
            try {
                MarketWidgetData.Asset pinned = new MarketWidgetData.Asset(new org.json.JSONObject(
                    preferences(context).getString("selected_hot_" + widgetId, "")));
                if (pinned.key().equals(selection)) {
                    result.add(pinned);
                    return result;
                }
            } catch (JSONException ignored) {
                return result;
            }
        }
        for (MarketWidgetData.Asset asset : assets) {
            if (asset.key().equals(selection)) {
                result.add(asset);
                return result;
            }
        }
        if (selection.isEmpty() && !assets.isEmpty()) result.add(assets.get(0));
        return result;
    }

    static synchronized boolean hasManualSelection(Context context, int widgetId) {
        return preferences(context).contains("manual_assets_" + widgetId);
    }

    static synchronized JSONObject editorState(Context context, int widgetId, boolean single, String initialSource)
        throws JSONException {
        JSONObject state = new JSONObject().put("profiles", new JSONArray()).put("settings", new JSONArray())
            .put("watchlist", new JSONArray()).put("hot", new JSONArray()).put("privacyMasked", !canDisplay(context));
        if (!canDisplay(context)) return state;
        String source = isConfigured(context, widgetId) ? source(context, widgetId) : initialSource;
        List<MarketWidgetData.Asset> selected = isConfigured(context, widgetId)
            ? assets(context, widgetId, single) : availableAssets(context, source);
        JSONArray selections = editorAssets(context, selected.subList(0, Math.min(single ? 1 : 3, selected.size())));
        JSONObject settings = new JSONObject().put("id", Integer.toString(widgetId))
            .put("kind", single ? "single" : "list").put("name", single ? "Single coin" : "Market list")
            .put("source", source).put("assets", selections);
        if (single && selections.length() > 0) settings.put("asset", selections.get(0));
        return state.put("settings", new JSONArray().put(settings))
            .put("watchlist", editorAssets(context, availableAssets(context, WATCHLIST)))
            .put("hot", editorAssets(context, availableAssets(context, HOT)));
    }

    private static JSONArray editorAssets(Context context, List<MarketWidgetData.Asset> assets) throws JSONException {
        JSONArray result = new JSONArray();
        for (MarketWidgetData.Asset asset : assets) {
            JSONObject item = asset.json();
            MarketWidgetData.Quote quote = quote(context, asset);
            if (quote != null) {
                if (!quote.symbol.isEmpty()) item.put("symbol", quote.symbol);
                if (!quote.name.isEmpty()) item.put("name", quote.name);
                if (!quote.iconUrl.isEmpty()) item.put("iconUrl", quote.iconUrl);
            }
            item.put("logoURL", item.optString("iconUrl"));
            item.remove("iconUrl");
            result.put(item);
        }
        return result;
    }

    static synchronized JSONObject saveSettings(Context context, int widgetId, boolean single, String raw)
        throws JSONException {
        if (raw.length() > 8192 || !canDisplay(context)) throw new IllegalArgumentException("Invalid widget settings");
        JSONObject input = new JSONObject(raw);
        String source = input.getString("source");
        if (!WATCHLIST.equals(source) && !HOT.equals(source)) throw new IllegalArgumentException("Invalid source");
        if (!(single ? "single" : "list").equals(input.getString("kind"))) {
            throw new IllegalArgumentException("Invalid widget kind");
        }
        JSONArray requested = input.getJSONArray("assets");
        if (requested.length() != (single ? 1 : 3)) throw new IllegalArgumentException("Invalid slot count");
        List<MarketWidgetData.Asset> candidates = availableAssets(context, WATCHLIST);
        candidates.addAll(availableAssets(context, HOT));
        candidates.addAll(assets(context, widgetId, single));
        JSONArray selected = new JSONArray();
        for (int index = 0; index < requested.length(); index++) {
            MarketWidgetData.Asset identity = new MarketWidgetData.Asset(requested.getJSONObject(index));
            MarketWidgetData.Asset canonical = null;
            for (MarketWidgetData.Asset candidate : candidates) {
                if (candidate.key().equals(identity.key())) { canonical = candidate; break; }
            }
            if (canonical == null) throw new IllegalArgumentException("Widget asset is no longer available");
            selected.put(canonical.json());
        }
        if (!preferences(context).edit().putString("source_" + widgetId, source)
            .putString("manual_assets_" + widgetId, selected.toString())
            .remove("selection_" + widgetId).remove("selected_hot_" + widgetId).commit()) {
            throw new IllegalStateException("Could not persist widget settings");
        }
        return editorState(context, widgetId, single, source).getJSONArray("settings").getJSONObject(0);
    }

    static synchronized boolean needsHotRanking(Context context, int widgetId, boolean single) {
        return canDisplay(context) && !hasManualSelection(context, widgetId) && HOT.equals(source(context, widgetId))
            && (!single || preferences(context).getString("selection_" + widgetId, "").isEmpty());
    }

    static List<MarketWidgetData.Asset> availableAssets(Context context) {
        return availableAssets(context, WATCHLIST);
    }

    static synchronized List<MarketWidgetData.Asset> availableAssets(Context context, String source) {
        if (!canDisplay(context)) return new ArrayList<>();
        if (WATCHLIST.equals(source)) return new ArrayList<>(configuration(context).assets);
        if (!HOT.equals(source)) return new ArrayList<>();
        List<MarketWidgetData.Asset> result = new ArrayList<>();
        try {
            JSONArray values = new JSONArray(preferences(context).getString("hot_assets", "[]"));
            for (int index = 0; index < Math.min(values.length(), MarketWidgetData.MAX_ASSETS); index++) {
                result.add(new MarketWidgetData.Asset(values.getJSONObject(index)));
            }
        } catch (JSONException ignored) {
            result.clear();
        }
        return result;
    }

    static synchronized long hotUpdatedAt(Context context) {
        return preferences(context).getLong("hot_updated", 0);
    }

    static synchronized void saveHot(Context context, List<MarketWidgetData.Asset> assets, long fetchedAt)
        throws JSONException {
        if (!canDisplay(context)) return;
        JSONArray values = new JSONArray();
        for (MarketWidgetData.Asset asset : assets) values.put(asset.json());
        if (!preferences(context).edit().putString("hot_assets", values.toString())
            .putLong("hot_updated", fetchedAt).commit()) throw new IllegalStateException("Could not persist hot coins");
    }

    private static List<MarketWidgetData.Asset> allAssets(Context context) {
        List<MarketWidgetData.Asset> assets = availableAssets(context);
        assets.addAll(availableAssets(context, HOT));
        if (canDisplay(context)) {
            for (String key : preferences(context).getAll().keySet()) {
                if (key.startsWith("manual_assets_")) {
                    try {
                        JSONArray selected = new JSONArray(preferences(context).getString(key, "[]"));
                        for (int index = 0; index < Math.min(3, selected.length()); index++) {
                            assets.add(new MarketWidgetData.Asset(selected.getJSONObject(index)));
                        }
                    } catch (JSONException ignored) {
                        // Corrupt selections cannot authorize requests.
                    }
                }
                if (!key.startsWith("selected_hot_")) continue;
                try {
                    assets.add(new MarketWidgetData.Asset(new org.json.JSONObject(preferences(context).getString(key, ""))));
                } catch (JSONException ignored) {
                    // Corrupt selections are never replaced with a different asset.
                }
            }
        }
        return assets;
    }

    static synchronized boolean contains(Context context, MarketWidgetData.Asset asset) {
        for (MarketWidgetData.Asset current : allAssets(context)) if (current.key().equals(asset.key())) return true;
        return false;
    }

    static synchronized MarketWidgetData.Quote quote(Context context, MarketWidgetData.Asset asset) {
        if (!canDisplay(context)) return null;
        return MarketWidgetData.Quote.cached(preferences(context).getString("quote_" + asset.key(), ""));
    }

    static synchronized MarketWidgetData.History history(Context context, MarketWidgetData.Asset asset) {
        if (!canDisplay(context)) return null;
        return MarketWidgetData.History.cached(preferences(context).getString("history_" + asset.key(), ""));
    }

    static synchronized boolean failed(Context context, MarketWidgetData.Asset asset) {
        return preferences(context).getBoolean("failed_" + asset.key(), false);
    }

    static synchronized void saveQuote(Context context, MarketWidgetData.Asset asset, MarketWidgetData.Quote quote)
        throws JSONException {
        if (!contains(context, asset)) return;
        if (!preferences(context).edit().putString("quote_" + asset.key(), quote.json().toString())
            .putBoolean("failed_" + asset.key(), false).commit()) throw new IllegalStateException("Could not persist market quote");
    }

    static synchronized void saveHistory(Context context, MarketWidgetData.Asset asset, MarketWidgetData.History history)
        throws JSONException {
        if (!contains(context, asset)) return;
        preferences(context).edit().putString("history_" + asset.key(), history.json().toString()).apply();
    }

    static synchronized void markFailed(Context context, MarketWidgetData.Asset asset) {
        if (contains(context, asset)) preferences(context).edit().putBoolean("failed_" + asset.key(), true).apply();
    }

    static synchronized void deleteWidget(Context context, int widgetId) {
        preferences(context).edit().remove("selection_" + widgetId).remove("source_" + widgetId)
            .remove("selected_hot_" + widgetId).remove("manual_assets_" + widgetId).apply();
    }

    static synchronized void restoreWidget(Context context, int oldId, int newId) {
        SharedPreferences.Editor editor = preferences(context).edit();
        for (String prefix : new String[]{"selection_", "source_", "selected_hot_", "manual_assets_"}) {
            if (preferences(context).contains(prefix + oldId)) {
                editor.putString(prefix + newId, preferences(context).getString(prefix + oldId, ""));
                editor.remove(prefix + oldId);
            }
        }
        editor.apply();
    }

    private MarketWidgetStore() {}
}
