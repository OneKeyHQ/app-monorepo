package so.onekey.app.wallet.marketwidget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.math.BigDecimal;
import java.text.DateFormat;
import java.text.NumberFormat;
import java.util.Arrays;
import java.util.Currency;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import so.onekey.app.wallet.MainLauncherActivity;
import so.onekey.app.wallet.R;

public class MarketWidgetProvider extends AppWidgetProvider {
    static final String REFRESH = "so.onekey.app.wallet.marketwidget.REFRESH";
    private static final long STALE_AFTER_MS = 60 * 60 * 1000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, id);
        MarketWidgetRefreshService.schedule(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (REFRESH.equals(intent.getAction())) {
            renderAll(context);
            MarketWidgetRefreshService.schedule(context);
        }
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) MarketWidgetStore.deleteWidget(context, id);
        MarketWidgetRefreshService.cancelIfUnused(context);
    }

    @Override
    public void onDisabled(Context context) {
        MarketWidgetRefreshService.cancelIfUnused(context);
    }

    @Override
    public void onRestored(Context context, int[] oldIds, int[] newIds) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int index = 0; index < oldIds.length; index++) {
            MarketWidgetStore.restoreWidget(context, oldIds[index], newIds[index]);
            Bundle options = new Bundle();
            options.putBoolean(AppWidgetManager.OPTION_APPWIDGET_RESTORE_COMPLETED, true);
            manager.updateAppWidgetOptions(newIds[index], options);
        }
        onUpdate(context, manager, newIds);
    }

    static int[] allIds(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] single = manager.getAppWidgetIds(new ComponentName(context, MarketSingleWidgetProvider.class));
        int[] list = manager.getAppWidgetIds(new ComponentName(context, MarketWatchlistWidgetProvider.class));
        int[] result = Arrays.copyOf(single, single.length + list.length);
        System.arraycopy(list, 0, result, single.length, list.length);
        return result;
    }

    static boolean isSingle(Context context, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
        return info != null && info.provider.equals(new ComponentName(context, MarketSingleWidgetProvider.class));
    }

    static boolean owns(Context context, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
        return info != null && (info.provider.equals(new ComponentName(context, MarketSingleWidgetProvider.class))
            || info.provider.equals(new ComponentName(context, MarketWatchlistWidgetProvider.class)));
    }

    static void renderAll(Context context) {
        for (int id : allIds(context)) render(context, id);
    }

    static void render(Context context, int id) {
        if (!owns(context, id)) return;
        Context textContext = MarketWidgetStore.localized(context);
        boolean single = isSingle(context, id);
        MarketWidgetData.Configuration configuration = MarketWidgetStore.configuration(context);
        List<MarketWidgetData.Asset> assets = MarketWidgetStore.assets(context, id, single);
        RemoteViews views = new RemoteViews(context.getPackageName(),
            single ? R.layout.market_widget_single : R.layout.market_widget_watchlist);
        views.setTextViewText(R.id.market_widget_title, "OneKey");
        views.setTextViewText(R.id.market_widget_currency, textContext.getString(R.string.market_widget_currency));
        views.setContentDescription(R.id.market_widget_refresh, textContext.getString(R.string.market_widget_refresh));
        views.setContentDescription(R.id.market_widget_configure, textContext.getString(R.string.market_widget_configure));

        Intent refresh = new Intent(context, single ? MarketSingleWidgetProvider.class : MarketWatchlistWidgetProvider.class)
            .setAction(REFRESH).setData(Uri.parse("onekey-widget-refresh://widget/" + id));
        views.setOnClickPendingIntent(R.id.market_widget_refresh, PendingIntent.getBroadcast(context, id, refresh,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent configure = new Intent(context, MarketWidgetConfigureActivity.class)
            .setData(Uri.parse("onekey-widget-configure://widget/" + id))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        PendingIntent configureIntent = PendingIntent.getActivity(context, id, configure,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.market_widget_configure, configureIntent);
        views.setTextViewText(R.id.market_widget_empty, textContext.getString(configuration.valid
            ? R.string.market_widget_empty : R.string.market_widget_configuration_error));
        views.setOnClickPendingIntent(R.id.market_widget_empty, configureIntent);
        views.setViewVisibility(R.id.market_widget_empty, assets.isEmpty() ? View.VISIBLE : View.GONE);

        int[] rows = {R.id.market_widget_row_1, R.id.market_widget_row_2, R.id.market_widget_row_3};
        int[] symbols = {R.id.market_widget_symbol_1, R.id.market_widget_symbol_2, R.id.market_widget_symbol_3};
        int[] prices = {R.id.market_widget_price_1, R.id.market_widget_price_2, R.id.market_widget_price_3};
        int[] changes = {R.id.market_widget_change_1, R.id.market_widget_change_2, R.id.market_widget_change_3};
        int[] times = {R.id.market_widget_time_1, R.id.market_widget_time_2, R.id.market_widget_time_3};
        int[] identities = {R.id.market_widget_identity_1, R.id.market_widget_identity_2, R.id.market_widget_identity_3};
        Locale locale = Locale.forLanguageTag(configuration.locale);
        for (int index = 0; index < (single ? 1 : 3); index++) {
            views.setViewVisibility(rows[index], index < assets.size() ? View.VISIBLE : View.GONE);
            if (index >= assets.size()) continue;
            MarketWidgetData.Asset asset = assets.get(index);
            MarketWidgetData.Quote quote = MarketWidgetStore.quote(context, asset);
            String symbol = quote != null && !quote.symbol.isEmpty() ? quote.symbol : asset.label();
            views.setTextViewText(symbols[index], symbol);
            views.setTextViewText(identities[index], "token".equals(asset.kind) ? asset.chainId
                : quote != null && !quote.name.isEmpty() ? quote.name : asset.name);
            views.setTextViewText(prices[index], quote == null ? "—" : price(quote.price, locale));
            String change = "—";
            int color = textContext.getColor(R.color.market_widget_secondary);
            if (quote != null && quote.change != null) {
                NumberFormat format = NumberFormat.getNumberInstance(locale);
                format.setMinimumFractionDigits(2);
                format.setMaximumFractionDigits(2);
                change = (quote.change.signum() > 0 ? "+" : "") + format.format(quote.change) + "%";
                if (quote.change.signum() != 0) {
                    boolean green = (quote.change.signum() > 0) == configuration.greenUp;
                    color = textContext.getColor(green ? R.color.market_widget_green : R.color.market_widget_red);
                }
            }
            views.setTextViewText(changes[index], change);
            views.setTextColor(changes[index], color);
            if (quote == null) {
                views.setTextViewText(times[index], textContext.getString(R.string.market_widget_unavailable));
            } else {
                boolean stale = MarketWidgetStore.failed(context, asset)
                    || System.currentTimeMillis() - quote.fetchedAt > STALE_AFTER_MS;
                String date = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, locale)
                    .format(new Date(quote.fetchedAt));
                views.setTextViewText(times[index], textContext.getString(stale
                    ? R.string.market_widget_cached_at : R.string.market_widget_updated_at, date));
            }
            Intent open = new Intent(Intent.ACTION_VIEW, asset.deepLink(), context, MainLauncherActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(rows[index], PendingIntent.getActivity(context, id * 3 + index, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        AppWidgetManager.getInstance(context).updateAppWidget(id, views);
    }

    static String price(BigDecimal value, Locale locale) {
        if (value.signum() > 0 && value.compareTo(new BigDecimal("0.000000000001")) < 0) {
            return "<$0.000000000001";
        }
        NumberFormat format = NumberFormat.getCurrencyInstance(locale);
        format.setCurrency(Currency.getInstance("USD"));
        format.setMinimumFractionDigits(2);
        int decimals = value.compareTo(BigDecimal.ONE) >= 0 || value.signum() == 0 ? 2
            : Math.min(12, Math.max(2, value.scale() - value.precision() + 4));
        format.setMaximumFractionDigits(decimals);
        return format.format(value);
    }
}
