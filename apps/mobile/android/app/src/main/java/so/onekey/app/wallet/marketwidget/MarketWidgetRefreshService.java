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
                Map<String, MarketWidgetData.Asset> assets = new LinkedHashMap<>();
                for (int widgetId : MarketWidgetProvider.allIds(this)) {
                    for (MarketWidgetData.Asset asset : MarketWidgetStore.assets(this, widgetId,
                        MarketWidgetProvider.isSingle(this, widgetId))) {
                        assets.put(asset.key(), asset);
                    }
                }
                String locale = MarketWidgetStore.configuration(this).locale;
                for (MarketWidgetData.Asset asset : assets.values()) {
                    if (Thread.currentThread().isInterrupted()) return;
                    MarketWidgetData.Quote cached = MarketWidgetStore.quote(this, asset);
                    // Coalesce rapid launcher callbacks and refresh taps without polling continuously.
                    if (cached != null && System.currentTimeMillis() - cached.fetchedAt < 30_000
                        && !MarketWidgetStore.failed(this, asset)) continue;
                    try {
                        MarketWidgetData.Quote quote = MarketWidgetClient.fetch(asset, locale);
                        if (Thread.currentThread().isInterrupted()) return;
                        MarketWidgetStore.saveQuote(this, asset, quote);
                    } catch (Exception ignored) {
                        if (Thread.currentThread().isInterrupted()) return;
                        MarketWidgetStore.markFailed(this, asset);
                    }
                    MarketWidgetProvider.renderAll(this);
                }
            } finally {
                new Handler(Looper.getMainLooper()).post(() -> jobFinished(parameters, false));
            }
        });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters parameters) {
        if (running != null) running.cancel(true);
        return MarketWidgetProvider.allIds(this).length > 0;
    }
}
