package so.onekey.app.wallet.marketwidget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

import so.onekey.app.wallet.MainLauncherActivity;
import so.onekey.app.wallet.R;

/** Launcher-owned configuration UI. It does not construct a React Native host. */
public final class MarketWidgetConfigureActivity extends Activity {
    private static final String SELECTED_ASSET = "selectedAsset";
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private boolean single;
    private String selectedAssetKey;
    private List<MarketWidgetData.Asset> assets = new ArrayList<>();
    private ListView list;
    private Button save;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(MarketWidgetStore.localized(base));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID || !MarketWidgetProvider.owns(this, widgetId)) {
            finish();
            return;
        }
        single = MarketWidgetProvider.isSingle(this, widgetId);
        if (savedInstanceState != null && savedInstanceState.containsKey(SELECTED_ASSET)) {
            selectedAssetKey = savedInstanceState.getString(SELECTED_ASSET);
        } else {
            List<MarketWidgetData.Asset> selected = MarketWidgetStore.assets(this, widgetId, true);
            if (!selected.isEmpty()) selectedAssetKey = selected.get(0).key();
        }
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        content.setFitsSystemWindows(true);
        content.setBackgroundColor(getColor(R.color.market_widget_background));
        TextView title = new TextView(this);
        title.setText(single ? R.string.market_widget_single_title : R.string.market_widget_watchlist_title);
        title.setTextSize(24);
        title.setTextColor(getColor(R.color.market_widget_foreground));
        content.addView(title);
        TextView description = new TextView(this);
        description.setText(single ? R.string.market_widget_select_description : R.string.market_widget_watchlist_description);
        description.setTextSize(15);
        description.setTextColor(getColor(R.color.market_widget_secondary));
        description.setPadding(0, padding, 0, padding);
        content.addView(description);

        list = new ListView(this);
        list.setChoiceMode(single ? ListView.CHOICE_MODE_SINGLE : ListView.CHOICE_MODE_NONE);
        list.setOnItemClickListener((parent, view, position, id) -> {
            if (single && position >= 0 && position < assets.size()) {
                selectedAssetKey = assets.get(position).key();
                save.setEnabled(true);
            }
        });
        content.addView(list, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        Button openApp = new Button(this);
        openApp.setText(R.string.market_widget_manage_watchlist);
        openApp.setOnClickListener(view -> startActivity(new Intent(Intent.ACTION_VIEW,
            Uri.parse("onekey-wallet://market_widget"), this, MainLauncherActivity.class)));
        content.addView(openApp);
        save = new Button(this);
        save.setText(R.string.market_widget_save);
        save.setOnClickListener(view -> {
            reloadAssets();
            if (single && selectedAssetKey == null) {
                Toast.makeText(this, R.string.market_widget_choose_asset, Toast.LENGTH_SHORT).show();
                return;
            }
            if (assets.isEmpty()) return;
            try {
                if (single) MarketWidgetStore.select(this, widgetId, selectedAssetKey);
                MarketWidgetProvider.render(this, widgetId);
                MarketWidgetRefreshService.configurationChanged(this);
                setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
                finish();
            } catch (RuntimeException ignored) {
                Toast.makeText(this, R.string.market_widget_save_failed, Toast.LENGTH_SHORT).show();
            }
        });
        content.addView(save);
        setContentView(content);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (list != null) reloadAssets();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putString(SELECTED_ASSET, selectedAssetKey);
        super.onSaveInstanceState(outState);
    }

    private void reloadAssets() {
        assets = MarketWidgetStore.availableAssets(this);
        List<String> labels = new ArrayList<>();
        int count = single ? assets.size() : Math.min(3, assets.size());
        int selectedIndex = -1;
        for (int index = 0; index < count; index++) {
            MarketWidgetData.Asset asset = assets.get(index);
            MarketWidgetData.Quote quote = MarketWidgetStore.quote(this, asset);
            String symbol = quote != null && !quote.symbol.isEmpty() ? quote.symbol : asset.label();
            labels.add(symbol + ("token".equals(asset.kind) ? " · " + asset.chainId : ""));
            if (asset.key().equals(selectedAssetKey)) selectedIndex = index;
        }
        // Preserve an unsaved choice by identity when the app changes the watchlist order.
        if (selectedIndex < 0) selectedAssetKey = null;
        list.clearChoices();
        list.setAdapter(new ArrayAdapter<>(this, single ? android.R.layout.simple_list_item_single_choice
            : android.R.layout.simple_list_item_1, labels));
        if (single && selectedIndex >= 0) list.setItemChecked(selectedIndex, true);
        save.setEnabled(single ? selectedIndex >= 0 : !assets.isEmpty());
    }
}
