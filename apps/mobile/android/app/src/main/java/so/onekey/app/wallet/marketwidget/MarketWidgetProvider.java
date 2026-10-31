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
import android.os.Build;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.graphics.Bitmap;
import android.widget.RemoteViews;

import java.math.BigDecimal;
import java.text.DateFormat;
import java.text.NumberFormat;
import java.util.Arrays;
import java.util.Currency;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;

import so.onekey.app.wallet.MainLauncherActivity;
import so.onekey.app.wallet.R;

public class MarketWidgetProvider extends AppWidgetProvider {
    static final String REFRESH = "so.onekey.app.wallet.marketwidget.REFRESH";
    private static final long STALE_AFTER_MS = 60 * 60 * 1000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, id);
        int listWidgetCount = manager.getAppWidgetIds(new ComponentName(context, MarketWatchlistWidgetProvider.class)).length;
        if (ownsPeriodicRefresh(this instanceof MarketWatchlistWidgetProvider, listWidgetCount)) {
            MarketWidgetRefreshService.schedule(context);
        }
    }

    static boolean ownsPeriodicRefresh(boolean listProvider, int listWidgetCount) {
        // Both providers have periodic broadcasts, but only one should fetch their shared assets.
        return listProvider || listWidgetCount == 0;
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
        // The remaining single widgets take over without waiting for their next periodic broadcast.
        if (this instanceof MarketWatchlistWidgetProvider) MarketWidgetRefreshService.schedule(context);
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
        for (int id : newIds) render(context, id);
        MarketWidgetRefreshService.configurationChanged(context);
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
        // Publish under the same lock as privacy/configuration writes so an old render cannot win a race.
        synchronized (MarketWidgetStore.class) {
            renderLocked(context, id);
        }
    }

    static Intent configureIntent(Context context, int id) {
        return new Intent(context, MarketWidgetConfigureActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .setData(Uri.parse("onekey-widget-configure://widget/" + id))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .putExtra(MarketWidgetConfigureActivity.EXTRA_EDIT_EXISTING, true);
    }

    private static void renderLocked(Context context, int id) {
        if (!owns(context, id)) return;
        Context textContext = MarketWidgetStore.localized(context);
        boolean single = isSingle(context, id);
        MarketWidgetData.Configuration configuration = MarketWidgetStore.configuration(context);
        List<MarketWidgetData.Asset> assets = MarketWidgetStore.assets(context, id, single);
        RemoteViews views = new RemoteViews(context.getPackageName(),
            single ? R.layout.market_widget_single : R.layout.market_widget_watchlist);
        boolean hot = MarketWidgetStore.HOT.equals(MarketWidgetStore.source(context, id));
        views.setTextViewText(R.id.market_widget_title, textContext.getString(MarketWidgetStore.hasManualSelection(context, id)
            ? (single ? R.string.market_widget_single_title : R.string.market_widget_watchlist_title)
            : (hot ? R.string.market_widget_source_hot : R.string.market_widget_source_watchlist)));
        views.setContentDescription(R.id.market_widget_configure, textContext.getString(R.string.market_widget_configure));
        Intent configure = configureIntent(context, id);
        PendingIntent configureIntent = PendingIntent.getActivity(context, id, configure,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.market_widget_configure, configureIntent);
        int emptyText = !configuration.valid ? R.string.market_widget_configuration_error
            : configuration.privacyMasked ? R.string.market_widget_private
            : hot ? R.string.market_widget_hot_unavailable : R.string.market_widget_watchlist_empty;
        views.setTextViewText(R.id.market_widget_empty, textContext.getString(emptyText));
        views.setOnClickPendingIntent(R.id.market_widget_empty, configureIntent);
        views.setViewVisibility(R.id.market_widget_empty, assets.isEmpty() ? View.VISIBLE : View.GONE);

        int[] rows = {R.id.market_widget_row_1, R.id.market_widget_row_2, R.id.market_widget_row_3};
        int[] symbols = {R.id.market_widget_symbol_1, R.id.market_widget_symbol_2, R.id.market_widget_symbol_3};
        int[] prices = {R.id.market_widget_price_1, R.id.market_widget_price_2, R.id.market_widget_price_3};
        int[] changes = {R.id.market_widget_change_1, R.id.market_widget_change_2, R.id.market_widget_change_3};
        int[] identities = {R.id.market_widget_identity_1, R.id.market_widget_identity_2, R.id.market_widget_identity_3};
        int[] icons = {R.id.market_widget_icon_1, R.id.market_widget_icon_2, R.id.market_widget_icon_3};
        int[] charts = {R.id.market_widget_chart_1, R.id.market_widget_chart_2, R.id.market_widget_chart_3};
        Locale locale = Locale.forLanguageTag(configuration.locale);
        String status = "";
        for (int index = 0; index < (single ? 1 : 3); index++) {
            views.setViewVisibility(rows[index], index < assets.size() ? View.VISIBLE : View.GONE);
            if (!single && index > 0) views.setViewVisibility(index == 1
                ? R.id.market_widget_separator_2 : R.id.market_widget_separator_3,
                index < assets.size() ? View.VISIBLE : View.GONE);
            if (index >= assets.size()) continue;
            MarketWidgetData.Asset asset = assets.get(index);
            MarketWidgetData.Quote quote = MarketWidgetStore.quote(context, asset);
            String symbol = quote != null && !quote.symbol.isEmpty() ? quote.symbol : asset.label();
            String name = quote != null && !quote.name.isEmpty() ? quote.name : asset.name;
            views.setTextViewText(symbols[index], symbol);
            if (!single) views.setTextViewText(identities[index], name);
            views.setTextViewText(prices[index], quote == null ? "—" : price(quote.price, locale));
            Bitmap icon = MarketWidgetImages.cached(context, asset);
            if (icon == null) views.setImageViewResource(icons[index], R.drawable.market_widget_token_placeholder);
            else views.setImageViewBitmap(icons[index], icon);
            views.setContentDescription(icons[index], symbol);
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
            if (!single) {
                MarketWidgetData.History history = MarketWidgetStore.history(context, asset);
                if (history != null && System.currentTimeMillis() - history.fetchedAt > STALE_AFTER_MS) history = null;
                views.setImageViewBitmap(charts[index], MarketWidgetImages.chart(history, color,
                    context.getResources().getDisplayMetrics().density));
                views.setContentDescription(charts[index], textContext.getString(history == null
                    ? R.string.market_widget_chart_unavailable : R.string.market_widget_chart));
            }
            if (quote == null) {
                status = textContext.getString(R.string.market_widget_unavailable);
            } else {
                boolean stale = MarketWidgetStore.failed(context, asset)
                    || System.currentTimeMillis() - quote.fetchedAt > STALE_AFTER_MS;
                String date = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, locale)
                    .format(new Date(quote.fetchedAt));
                if (stale) status = textContext.getString(R.string.market_widget_cached_at, date);
                views.setContentDescription(rows[index], textContext.getString(stale
                    ? R.string.market_widget_quote_cached_at : R.string.market_widget_quote_updated_at,
                    symbol, price(quote.price, locale, false), change, date));
            }
            Intent open = new Intent(Intent.ACTION_VIEW, asset.deepLink(), context, MainLauncherActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(rows[index], PendingIntent.getActivity(context, id * 3 + index, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        views.setTextViewText(R.id.market_widget_status, status);
        views.setViewVisibility(R.id.market_widget_status, status.isEmpty() ? View.GONE : View.VISIBLE);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        manager.updateAppWidget(id, single
            ? singleSizedViews(views, manager.getAppWidgetOptions(id), !status.isEmpty()) : views);
    }

    private static RemoteViews singleSizedViews(RemoteViews views, Bundle options, boolean hasStatus) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return views;
        List<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
        if (sizes == null || sizes.isEmpty()) {
            // Older launchers only expose the portrait and landscape bounds.
            sizes = Arrays.asList(
                new SizeF(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140),
                    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 160)),
                new SizeF(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 140),
                    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 160)));
        }
        Map<SizeF, RemoteViews> layouts = new LinkedHashMap<>();
        for (SizeF size : sizes) {
            if (size.getWidth() <= 0 || size.getHeight() <= 0) continue;
            RemoteViews sized = new RemoteViews(views);
            // Launcher rows can be much taller than columns; keep the card's reference proportions.
            sized.setViewLayoutHeight(R.id.market_widget_root,
                Math.min(size.getHeight(), size.getWidth() * 8f / 7f + (hasStatus ? 16f : 0f)),
                TypedValue.COMPLEX_UNIT_DIP);
            layouts.put(size, sized);
            if (layouts.size() == 16) break;
        }
        return layouts.isEmpty() ? views : new RemoteViews(layouts);
    }

    static String price(BigDecimal value, Locale locale) {
        return price(value, locale, true);
    }

    static String price(BigDecimal value, Locale locale, boolean includeCurrency) {
        boolean belowMinimum = value.signum() > 0 && value.compareTo(new BigDecimal("0.000000000001")) < 0;
        BigDecimal displayed = belowMinimum ? new BigDecimal("0.000000000001") : value;
        NumberFormat format = includeCurrency
            ? NumberFormat.getCurrencyInstance(locale) : NumberFormat.getNumberInstance(locale);
        if (includeCurrency) format.setCurrency(Currency.getInstance("USD"));
        format.setMinimumFractionDigits(2);
        int decimals = displayed.compareTo(BigDecimal.ONE) >= 0 || displayed.signum() == 0 ? 2
            : Math.min(12, Math.max(2, displayed.scale() - displayed.precision() + 4));
        format.setMaximumFractionDigits(decimals);
        return (belowMinimum ? "<" : "") + format.format(displayed);
    }
}
