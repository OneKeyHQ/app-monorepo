package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.app.Dialog;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import so.onekey.app.wallet.MainLauncherActivity;
import so.onekey.app.wallet.R;

/** Launcher-owned editor; market data and selections never depend on a React Native host. */
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

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private boolean single;
    private String source;
    private String selectedAssetKey;
    private List<MarketWidgetData.Asset> assets = new ArrayList<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView sourceValue;
    private TextView coinValue;
    private TextView save;
    private TextView message;
    private boolean loading;
    private boolean failed;
    private Dialog activeSheet;
    private CoinAdapter coinAdapter;
    private final SharedPreferences.OnSharedPreferenceChangeListener configurationListener = (preferences, key) -> {
        if (!"configuration".equals(key)) return;
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            if (activeSheet != null) activeSheet.dismiss();
            coinAdapter = null;
            reloadAssets();
            if (MarketWidgetStore.canDisplay(this)) loadHot(false);
        });
    };

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(MarketWidgetStore.localized(base));
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID || !MarketWidgetProvider.owns(this, widgetId)) {
            finish();
            return;
        }
        single = MarketWidgetProvider.isSingle(this, widgetId);
        InitialEditorState initial = initialEditorState(this, getIntent(), widgetId, single);
        source = state != null ? state.getString("source", initial.source) : initial.source;
        selectedAssetKey = state != null ? state.getString("selectedAsset") : initial.assetKey;
        LinearLayout root = column();
        root.setPadding(dp(16), 0, dp(16), dp(20));
        root.setBackgroundColor(getColor(R.color.market_widget_background));
        ImageView back = new ImageView(this);
        back.setImageResource(R.drawable.market_widget_back);
        back.setContentDescription(getString(R.string.market_widget_back));
        back.setPadding(0, dp(20), dp(24), dp(20));
        back.setOnClickListener(view -> finish());
        root.addView(back, new LinearLayout.LayoutParams(dp(48), dp(76)));
        TextView title = text(getString(R.string.market_widget_edit_title), 25, true, false);
        root.addView(title);
        TextView description = text(getString(R.string.market_widget_edit_description), 13, false, true);
        description.setPadding(0, dp(13), 0, dp(26));
        root.addView(description);
        sourceValue = field(root, R.string.market_widget_source, view -> showSources());
        if (single) coinValue = field(root, R.string.market_widget_coin, view -> showCoins());
        message = text("", 13, false, true);
        message.setPadding(0, dp(16), 0, dp(16));
        message.setOnClickListener(view -> {
            if (MarketWidgetStore.HOT.equals(source)) loadHot(true);
            else startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("onekey-wallet://market_widget"),
                this, MainLauncherActivity.class));
        });
        root.addView(message);
        root.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1));
        save = text(getString(R.string.market_widget_done), 15, true, false);
        save.setTextColor(Color.BLACK);
        save.setGravity(Gravity.CENTER);
        save.setBackground(rounded(getColor(R.color.market_widget_accent), 8));
        save.setOnClickListener(view -> save());
        root.addView(save, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        FrameLayout safeArea = new FrameLayout(this);
        safeArea.setFitsSystemWindows(true);
        safeArea.setBackgroundColor(getColor(R.color.market_widget_background));
        safeArea.addView(root, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(safeArea);
        MarketWidgetStore.addConfigurationListener(this, configurationListener);
        reloadAssets();
        loadHot(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (save != null) reloadAssets();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putString("source", source);
        state.putString("selectedAsset", selectedAssetKey);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onDestroy() {
        MarketWidgetStore.removeConfigurationListener(this, configurationListener);
        if (activeSheet != null) activeSheet.dismiss();
        executor.shutdownNow();
        super.onDestroy();
    }

    private void reloadAssets() {
        assets = MarketWidgetStore.availableAssets(this, source);
        if (MarketWidgetStore.HOT.equals(source) && source.equals(MarketWidgetStore.source(this, widgetId))) {
            for (MarketWidgetData.Asset pinned : MarketWidgetStore.assets(this, widgetId, true)) {
                boolean found = false;
                for (MarketWidgetData.Asset asset : assets) if (asset.key().equals(pinned.key())) found = true;
                if (!found && pinned.key().equals(selectedAssetKey)) assets.add(0, pinned);
            }
        }
        MarketWidgetData.Asset selected = selected();
        if (selected == null && selectedAssetKey == null && !assets.isEmpty()) {
            selectedAssetKey = assets.get(0).key();
            selected = assets.get(0);
        }
        sourceValue.setText(getString(MarketWidgetStore.HOT.equals(source)
            ? R.string.market_widget_source_hot : R.string.market_widget_source_watchlist) + "  ›");
        if (coinValue != null) coinValue.setText((selected == null ? "—" : label(selected)) + "  ›");
        boolean valid = MarketWidgetStore.canDisplay(this) && (!single || selected != null);
        save.setEnabled(valid);
        save.setAlpha(valid ? 1f : 0.4f);
        int status = !MarketWidgetStore.canDisplay(this) ? R.string.market_widget_private
            : loading ? R.string.market_widget_loading
            : assets.isEmpty() ? MarketWidgetStore.HOT.equals(source)
                ? failed ? R.string.market_widget_load_failed : R.string.market_widget_loading
                : R.string.market_widget_watchlist_empty : 0;
        message.setText(status == 0 ? "" : getString(status));
        if (coinAdapter != null) coinAdapter.filter(coinAdapter.query);
    }

    private void loadHot(boolean force) {
        if (!MarketWidgetStore.HOT.equals(source) || loading || !MarketWidgetStore.canDisplay(this)) return;
        if (!force && System.currentTimeMillis() - MarketWidgetStore.hotUpdatedAt(this) < 5 * 60_000) {
            hydrate();
            return;
        }
        loading = true;
        failed = false;
        reloadAssets();
        executor.execute(() -> {
            boolean succeeded = false;
            try {
                MarketWidgetStore.saveHot(this, MarketWidgetClient.fetchHot(MarketWidgetStore.configuration(this).locale),
                    System.currentTimeMillis());
                succeeded = true;
            } catch (Exception ignored) {
                // The editor exposes a retry without replacing a valid cached selection.
            }
            final boolean result = succeeded;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                loading = false;
                failed = !result;
                reloadAssets();
                hydrate();
            });
        });
    }

    private void hydrate() {
        List<MarketWidgetData.Asset> pending = new ArrayList<>(assets);
        executor.execute(() -> {
            for (MarketWidgetData.Asset asset : pending) {
                if (Thread.currentThread().isInterrupted()) return;
                if (!asset.iconUrl.isEmpty()) {
                    try { MarketWidgetImages.fetch(this, asset, asset.iconUrl); } catch (Exception ignored) { }
                } else MarketWidgetRefreshService.refreshAsset(this, asset, MarketWidgetStore.configuration(this).locale, false);
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed() && coinAdapter != null) coinAdapter.notifyDataSetChanged();
                });
            }
        });
    }

    private void save() {
        reloadAssets();
        try {
            MarketWidgetStore.configure(this, widgetId, source, selectedAssetKey, single);
            MarketWidgetProvider.render(this, widgetId);
            MarketWidgetRefreshService.configurationChanged(this);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            finish();
        } catch (RuntimeException ignored) {
            Toast.makeText(this, R.string.market_widget_save_failed, Toast.LENGTH_SHORT).show();
        }
    }

    private void showSources() {
        LinearLayout content = sheet(0);
        for (String option : new String[]{MarketWidgetStore.WATCHLIST, MarketWidgetStore.HOT}) {
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            TextView label = text(getString(MarketWidgetStore.HOT.equals(option)
                ? R.string.market_widget_source_hot : R.string.market_widget_source_watchlist), 16, false, false);
            row.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            row.addView(selection(source.equals(option)), new LinearLayout.LayoutParams(dp(20), dp(20)));
            content.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
            row.setOnClickListener(view -> {
                if (!source.equals(option)) {
                    source = option;
                    selectedAssetKey = null;
                    failed = false;
                }
                activeSheet.dismiss();
                reloadAssets();
                if (MarketWidgetStore.HOT.equals(source)) loadHot(false); else hydrate();
            });
        }
        showSheet(content);
    }

    private void showCoins() {
        LinearLayout content = sheet(R.string.market_widget_coin);
        EditText search = new EditText(this);
        search.setSingleLine(true);
        search.setTextSize(14);
        search.setTextColor(getColor(R.color.market_widget_foreground));
        search.setHintTextColor(getColor(R.color.market_widget_secondary));
        search.setHint(R.string.market_widget_search);
        search.setGravity(Gravity.CENTER_VERTICAL);
        search.setPadding(dp(8), 0, dp(8), 0);
        Drawable searchIcon = getDrawable(R.drawable.market_widget_search);
        if (searchIcon != null) {
            searchIcon.setBounds(0, 0, dp(12), dp(12));
            search.setCompoundDrawablesRelative(searchIcon, null, null, null);
            search.setCompoundDrawablePadding(dp(6));
        }
        search.setBackground(rounded(getColor(R.color.market_widget_field), 8));
        content.addView(search, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(31)));
        ListView list = new ListView(this);
        list.setDivider(null);
        list.setVerticalScrollBarEnabled(false);
        coinAdapter = new CoinAdapter();
        list.setAdapter(coinAdapter);
        coinAdapter.filter("");
        list.setOnItemClickListener((parent, view, position, id) -> {
            selectedAssetKey = coinAdapter.filtered.get(position).key();
            activeSheet.dismiss();
            reloadAssets();
        });
        LinearLayout.LayoutParams listParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1);
        listParams.topMargin = dp(9);
        content.addView(list, listParams);
        TextView empty = text(getString(assets.isEmpty() && MarketWidgetStore.WATCHLIST.equals(source)
            ? R.string.market_widget_watchlist_empty : R.string.market_widget_no_coins), 14, false, true);
        empty.setGravity(Gravity.CENTER);
        content.addView(empty, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(120)));
        list.setEmptyView(empty);
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence value, int start, int count, int after) { }
            public void onTextChanged(CharSequence value, int start, int before, int count) {
                coinAdapter.filter(value.toString());
            }
            public void afterTextChanged(Editable value) { }
        });
        showSheet(content);
        hydrate();
    }

    private LinearLayout sheet(int title) {
        LinearLayout content = column();
        content.setPadding(dp(16), dp(6), dp(16), dp(24));
        GradientDrawable background = rounded(getColor(R.color.market_widget_background), 0);
        float radius = dp(16);
        background.setCornerRadii(new float[]{radius, radius, radius, radius, 0, 0, 0, 0});
        content.setBackground(background);
        View handle = new View(this);
        handle.setBackground(rounded(getColor(R.color.market_widget_secondary), 2));
        handle.setAlpha(0.36f);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(38), dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = dp(title == 0 ? 4 : 20);
        content.addView(handle, handleParams);
        if (title != 0) {
            TextView label = text(getString(title), 17, true, false);
            label.setPadding(0, 0, 0, dp(22));
            content.addView(label);
        }
        return content;
    }

    private void showSheet(LinearLayout content) {
        activeSheet = new Dialog(this);
        activeSheet.requestWindowFeature(Window.FEATURE_NO_TITLE);
        activeSheet.setContentView(content);
        Window window = activeSheet.getWindow();
        if (window == null) return;
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.setFitInsetsTypes(0);
            window.setAttributes(attributes);
        }
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        window.setDimAmount(0.5f);
        window.setGravity(Gravity.BOTTOM);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            int bottomInset = insets.getInsets(WindowInsetsCompat.Type.navigationBars()
                | WindowInsetsCompat.Type.ime()).bottom;
            view.setPadding(dp(16), dp(6), dp(16), dp(24) + bottomInset);
            return insets;
        });
        activeSheet.show();
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT,
            Math.round(getResources().getDisplayMetrics().heightPixels * 0.913f));
        ViewCompat.requestApplyInsets(content);
    }

    private TextView field(LinearLayout parent, int label, View.OnClickListener click) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text(getString(label), 16, false, false);
        row.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView value = text("", 13, false, true);
        value.setGravity(Gravity.END);
        row.addView(value);
        row.setOnClickListener(click);
        parent.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));
        return value;
    }

    private ImageView selection(boolean selected) {
        ImageView check = new ImageView(this);
        check.setImageResource(R.drawable.market_widget_selected);
        check.setVisibility(selected ? View.VISIBLE : View.INVISIBLE);
        if (selected) check.setContentDescription(getString(R.string.market_widget_selected));
        return check;
    }

    private MarketWidgetData.Asset selected() {
        for (MarketWidgetData.Asset asset : assets) if (asset.key().equals(selectedAssetKey)) return asset;
        return null;
    }

    private String label(MarketWidgetData.Asset asset) {
        MarketWidgetData.Quote quote = MarketWidgetStore.quote(this, asset);
        return quote != null && !quote.symbol.isEmpty() ? quote.symbol : asset.label();
    }

    private LinearLayout column() {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(LinearLayout.VERTICAL);
        return view;
    }

    private TextView text(String value, int size, boolean bold, boolean secondary) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(getColor(secondary ? R.color.market_widget_secondary : R.color.market_widget_foreground));
        if (bold) view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return view;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class CoinAdapter extends BaseAdapter {
        private final List<MarketWidgetData.Asset> filtered = new ArrayList<>();
        private String query = "";

        void filter(String value) {
            query = value;
            filtered.clear();
            String search = value.trim().toLowerCase(Locale.ROOT);
            for (MarketWidgetData.Asset asset : assets) {
                MarketWidgetData.Quote quote = MarketWidgetStore.quote(MarketWidgetConfigureActivity.this, asset);
                String name = quote != null && !quote.name.isEmpty() ? quote.name : asset.name;
                if ((label(asset) + " " + name).toLowerCase(Locale.ROOT).contains(search)) filtered.add(asset);
            }
            notifyDataSetChanged();
        }

        public int getCount() { return filtered.size(); }
        public Object getItem(int position) { return filtered.get(position); }
        public long getItemId(int position) { return position; }
        public View getView(int position, View recycled, ViewGroup parent) {
            MarketWidgetData.Asset asset = filtered.get(position);
            LinearLayout row = new LinearLayout(MarketWidgetConfigureActivity.this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(11), 0, dp(11));
            LinearLayout labels = column();
            labels.addView(text(label(asset), 15, false, false));
            MarketWidgetData.Quote quote = MarketWidgetStore.quote(MarketWidgetConfigureActivity.this, asset);
            TextView name = text(quote != null && !quote.name.isEmpty() ? quote.name : asset.name, 12, false, true);
            name.setPadding(0, dp(4), 0, 0);
            labels.addView(name);
            row.addView(labels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            row.addView(selection(asset.key().equals(selectedAssetKey)),
                new LinearLayout.LayoutParams(dp(20), dp(20)));
            return row;
        }
    }
}
