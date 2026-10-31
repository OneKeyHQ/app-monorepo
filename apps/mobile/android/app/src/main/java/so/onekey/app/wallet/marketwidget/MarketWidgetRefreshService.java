package so.onekey.app.wallet.marketwidget;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** One bounded native fetch job; Android owns scheduling and battery restrictions. */
public final class MarketWidgetRefreshService extends JobService {
    private static final int JOB_ID = 0x4f4b5701;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private Future<?> running;

    static final class AssetRequest {
        MarketWidgetData.Asset asset;
        boolean needsChart;

        AssetRequest(MarketWidgetData.Asset asset, boolean needsChart) {
            this.asset = asset;
            this.needsChart = needsChart;
        }
    }

    static void addAssetRequest(Map<String, AssetRequest> requests, MarketWidgetData.Asset asset, boolean needsChart) {
        AssetRequest existing = requests.get(asset.key());
        if (existing == null) requests.put(asset.key(), new AssetRequest(asset, needsChart));
        else {
            existing.asset = asset;
            existing.needsChart |= needsChart;
        }
    }

    static void schedule(Context context) {
        if (MarketWidgetProvider.allIds(context).length == 0) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null || scheduler.getPendingJob(JOB_ID) != null) return;
        JobInfo request = new JobInfo.Builder(JOB_ID, new ComponentName(context, MarketWidgetRefreshService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setBackoffCriteria(30_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .build();
        scheduler.schedule(request);
    }

    static void cancelIfUnused(Context context) {
        if (MarketWidgetProvider.allIds(context).length != 0) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }

    static void configurationChanged(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
        schedule(context);
    }

    @Override
    public boolean onStartJob(JobParameters parameters) {
        running = EXECUTOR.submit(() -> {
            try {
                if (!MarketWidgetStore.canDisplay(this)) return;
                String locale = MarketWidgetStore.configuration(this).locale;
                boolean needsHotRanking = false;
                for (int widgetId : MarketWidgetProvider.allIds(this)) {
                    if (MarketWidgetStore.needsHotRanking(this, widgetId, MarketWidgetProvider.isSingle(this, widgetId))) {
                        needsHotRanking = true;
                    }
                }
                if (needsHotRanking && System.currentTimeMillis() - MarketWidgetStore.hotUpdatedAt(this) > 5 * 60_000) {
                    try {
                        MarketWidgetStore.saveHot(this, MarketWidgetClient.fetchHot(locale), System.currentTimeMillis());
                    } catch (Exception ignored) {
                        // Keep the last real ranking while offline.
                    }
                }
                Map<String, AssetRequest> assets = new LinkedHashMap<>();
                for (int widgetId : MarketWidgetProvider.allIds(this)) {
                    boolean single = MarketWidgetProvider.isSingle(this, widgetId);
                    for (MarketWidgetData.Asset asset : MarketWidgetStore.assets(this, widgetId, single)) {
                        addAssetRequest(assets, asset, !single);
                    }
                }
                MarketWidgetProvider.renderAll(this);
                for (AssetRequest request : assets.values()) {
                    if (Thread.currentThread().isInterrupted() || !MarketWidgetStore.canDisplay(this)) return;
                    refreshAsset(this, request.asset, locale, request.needsChart);
                    MarketWidgetProvider.renderAll(this);
                }
            } finally {
                new Handler(Looper.getMainLooper()).post(() -> jobFinished(parameters, false));
            }
        });
        return true;
    }

    static void refreshAsset(Context context, MarketWidgetData.Asset asset, String locale, boolean chart) {
        if (!MarketWidgetStore.contains(context, asset)) return;
        MarketWidgetData.Quote quote = MarketWidgetStore.quote(context, asset);
        if (quote == null || System.currentTimeMillis() - quote.fetchedAt >= 30_000
            || MarketWidgetStore.failed(context, asset)) {
            try {
                quote = MarketWidgetClient.fetch(asset, locale);
                if (Thread.currentThread().isInterrupted()) return;
                MarketWidgetStore.saveQuote(context, asset, quote);
            } catch (Exception ignored) {
                MarketWidgetStore.markFailed(context, asset);
            }
        }
        if (Thread.currentThread().isInterrupted()) return;
        try {
            MarketWidgetImages.fetch(context, asset, quote != null && !quote.iconUrl.isEmpty() ? quote.iconUrl : asset.iconUrl);
        } catch (Exception ignored) {
            // An unavailable image does not invalidate the price.
        }
        if (Thread.currentThread().isInterrupted() || !MarketWidgetStore.contains(context, asset)) return;
        MarketWidgetData.History history = MarketWidgetStore.history(context, asset);
        if (chart && !"stock".equals(asset.kind)
            && (history == null || System.currentTimeMillis() - history.fetchedAt >= 15 * 60_000)) {
            try {
                MarketWidgetStore.saveHistory(context, asset, MarketWidgetClient.fetchHistory(asset, locale));
            } catch (Exception ignored) {
                // Only actual server history is drawn; the renderer expires stale curves.
            }
        }
    }

    @Override
    public boolean onStopJob(JobParameters parameters) {
        if (running != null) running.cancel(true);
        return MarketWidgetProvider.allIds(this).length > 0;
    }
}
