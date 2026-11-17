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
        if (MarketWidgetProvider.allIds(context).length == 0) {
            MarketWidgetLog.event("refresh.schedule_skipped", "reason", "no_widgets");
            return;
        }
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null || scheduler.getPendingJob(JOB_ID) != null) {
            MarketWidgetLog.event("refresh.schedule_skipped", "reason", scheduler == null ? "scheduler_unavailable" : "already_pending");
            return;
        }
        JobInfo request = new JobInfo.Builder(JOB_ID, new ComponentName(context, MarketWidgetRefreshService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setBackoffCriteria(30_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .build();
        int result = scheduler.schedule(request);
        MarketWidgetLog.event("refresh.scheduled", "accepted", result == JobScheduler.RESULT_SUCCESS);
    }

    static void cancelIfUnused(Context context) {
        if (MarketWidgetProvider.allIds(context).length != 0) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }

    static void configurationChanged(Context context) {
        MarketWidgetLog.event("refresh.configuration_changed");
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
        schedule(context);
    }

    @Override
    public boolean onStartJob(JobParameters parameters) {
        MarketWidgetLog.initialize(this);
        running = EXECUTOR.submit(() -> {
            MarketWidgetLog.refreshId.set(java.util.UUID.randomUUID().toString());
            long started = android.os.SystemClock.elapsedRealtime();
            MarketWidgetLog.event("refresh.started", "widgetCount", MarketWidgetProvider.allIds(this).length);
            try {
                if (!MarketWidgetStore.canDisplay(this)) {
                    MarketWidgetLog.event("refresh.skipped", "reason", "privacy_or_configuration");
                    return;
                }
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
                    } catch (Exception error) {
                        MarketWidgetLog.failure("refresh.ranking_fallback", error);
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
                MarketWidgetLog.event("refresh.assets_selected", "assetCount", assets.size());
                for (AssetRequest request : assets.values()) {
                    if (Thread.currentThread().isInterrupted() || !MarketWidgetStore.canDisplay(this)) return;
                    refreshAsset(this, request.asset, locale, request.needsChart);
                    MarketWidgetProvider.renderAll(this);
                }
            } finally {
                MarketWidgetLog.event("refresh.finished", "durationMs", android.os.SystemClock.elapsedRealtime() - started,
                    "interrupted", Thread.currentThread().isInterrupted());
                MarketWidgetLog.refreshId.remove();
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
                MarketWidgetLog.event("refresh.quote_saved", "kind", asset.kind);
            } catch (Exception error) {
                MarketWidgetLog.failure("refresh.quote_fallback", error, "hasCache", quote != null);
                MarketWidgetStore.markFailed(context, asset);
            }
        } else {
            MarketWidgetLog.event("refresh.quote_cache_hit", "ageMs", System.currentTimeMillis() - quote.fetchedAt);
        }
        if (Thread.currentThread().isInterrupted()) return;
        try {
            MarketWidgetImages.fetch(context, asset, quote != null && !quote.iconUrl.isEmpty() ? quote.iconUrl : asset.iconUrl);
        } catch (Exception error) {
            MarketWidgetLog.failure("refresh.icon_fallback", error);
            // An unavailable image does not invalidate the price.
        }
        if (Thread.currentThread().isInterrupted() || !MarketWidgetStore.contains(context, asset)) return;
        MarketWidgetData.History history = MarketWidgetStore.history(context, asset);
        if (chart && !"stock".equals(asset.kind)
            && (history == null || System.currentTimeMillis() - history.fetchedAt >= 15 * 60_000)) {
            try {
                MarketWidgetStore.saveHistory(context, asset, MarketWidgetClient.fetchHistory(asset, locale));
                MarketWidgetLog.event("refresh.chart_saved");
            } catch (Exception error) {
                MarketWidgetLog.failure("refresh.chart_fallback", error, "hasCache", history != null);
                // Only actual server history is drawn; the renderer expires stale curves.
            }
        } else {
            MarketWidgetLog.event("refresh.chart_skipped", "reason", !chart ? "not_requested"
                : "stock".equals(asset.kind) ? "included_in_quote" : "cache_fresh");
        }
    }

    @Override
    public boolean onStopJob(JobParameters parameters) {
        MarketWidgetLog.event("refresh.stopped_by_system");
        if (running != null) running.cancel(true);
        return MarketWidgetProvider.allIds(this).length > 0;
    }
}
