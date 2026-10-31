package so.onekey.app.wallet.marketwidget;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

/** Opaque handoff from the launcher to the app's existing React Native host. */
final class MarketWidgetEditorSession {
    static final String COMPLETED = "so.onekey.app.wallet.marketwidget.EDITOR_COMPLETED";
    static final String EXTRA_SESSION = "editorSession";
    private static final String PREFERENCES = "onekey_market_widget_editor_sessions";

    final String token;
    final int widgetId;
    final boolean single;
    final String source;
    final int result;
    final boolean saved;

    private MarketWidgetEditorSession(String token, JSONObject value) throws JSONException {
        this.token = token;
        widgetId = value.getInt("widgetId");
        single = value.getBoolean("single");
        source = value.getString("source");
        result = value.optInt("result", 0);
        saved = value.optBoolean("saved", false);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static synchronized String create(Context context, int widgetId, boolean single, String source) throws JSONException {
        if (!MarketWidgetProvider.owns(context, widgetId) || MarketWidgetProvider.isSingle(context, widgetId) != single) {
            throw new IllegalArgumentException("Invalid market widget");
        }
        SharedPreferences preferences = preferences(context);
        SharedPreferences.Editor editor = preferences.edit();
        for (String key : preferences.getAll().keySet()) {
            try {
                JSONObject previous = new JSONObject(preferences.getString(key, ""));
                if (previous.getInt("widgetId") == widgetId
                    || System.currentTimeMillis() - previous.getLong("createdAt") > 24 * 60 * 60_000L) editor.remove(key);
            } catch (JSONException ignored) {
                editor.remove(key);
            }
        }
        String token = UUID.randomUUID().toString();
        JSONObject value = new JSONObject().put("widgetId", widgetId).put("single", single).put("source", source)
            .put("createdAt", System.currentTimeMillis());
        if (!editor.putString(token, value.toString()).commit()) throw new IllegalStateException("Could not open editor");
        return token;
    }

    static synchronized MarketWidgetEditorSession read(Context context, String token) throws JSONException {
        if (token == null || !UUID.fromString(token).toString().equals(token)) {
            throw new IllegalArgumentException("Invalid editor session");
        }
        return new MarketWidgetEditorSession(token, new JSONObject(preferences(context).getString(token, "")));
    }

    static synchronized MarketWidgetEditorSession requireActive(Context context, String token) throws JSONException {
        MarketWidgetEditorSession session = read(context, token);
        if (session.result != 0 || !MarketWidgetProvider.owns(context, session.widgetId)
            || MarketWidgetProvider.isSingle(context, session.widgetId) != session.single) {
            throw new IllegalArgumentException("Widget editor is no longer active");
        }
        return session;
    }

    static synchronized void markSaved(Context context, String token) throws JSONException {
        requireActive(context, token);
        JSONObject value = new JSONObject(preferences(context).getString(token, "")).put("saved", true);
        if (!preferences(context).edit().putString(token, value.toString()).commit()) {
            throw new IllegalStateException("Could not persist editor result");
        }
    }

    static synchronized void complete(Context context, String token, boolean saved) throws JSONException {
        MarketWidgetEditorSession session = read(context, token);
        if (session.result != 0) return;
        if (saved && !session.saved) throw new IllegalArgumentException("Widget settings have not been saved");
        JSONObject value = new JSONObject(preferences(context).getString(token, "")).put("result", saved ? 1 : -1);
        if (!preferences(context).edit().putString(token, value.toString()).commit()) {
            throw new IllegalStateException("Could not finish widget editor");
        }
        context.sendBroadcast(new Intent(COMPLETED).setPackage(context.getPackageName()).putExtra(EXTRA_SESSION, token));
    }

    static synchronized void remove(Context context, String token) {
        if (token != null) preferences(context).edit().remove(token).apply();
    }
}
