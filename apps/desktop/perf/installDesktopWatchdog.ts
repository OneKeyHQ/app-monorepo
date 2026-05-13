import { showExportLogsDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/showExportLogsDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { addBreadcrumb } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getTimerCensus } from '@onekeyhq/shared/src/utils/timerRegistry';

import { ipcMessageKeys } from '../app/config';

const LONG_TASK_MIN_MS = 200;
const SENTRY_BREADCRUMB_RATE_LIMIT_PER_MIN = 10;
const INTERVAL_CENSUS_DUMP_MS = 60_000;

let installed = false;

export function installDesktopWatchdog(): void {
  if (installed) return;
  if (!platformEnv.isDesktop) return;
  installed = true;

  installLongTaskObserver();
  installIntervalCensus();
  installExportLogsListener();
}

function installLongTaskObserver() {
  if (typeof globalThis.PerformanceObserver === 'undefined') return;

  let breadcrumbsInWindow = 0;
  let windowStart = Date.now();

  try {
    const observer = new globalThis.PerformanceObserver((list) => {
      const now = Date.now();
      if (now - windowStart > 60_000) {
        breadcrumbsInWindow = 0;
        windowStart = now;
      }

      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_MIN_MS) {
          // The observer callback runs after the long task ends, so this
          // stack only points at the observer frame. Useful in aggregate,
          // not for pinpointing a single offender.
          const stack = new Error('LongTask').stack;
          defaultLogger.app.perf.longTask({
            durationMs: Math.round(entry.duration),
            name: entry.name,
            stack,
          });

          if (breadcrumbsInWindow < SENTRY_BREADCRUMB_RATE_LIMIT_PER_MIN) {
            breadcrumbsInWindow += 1;
            try {
              addBreadcrumb({
                category: 'longtask',
                level: 'warning',
                message: `LongTask ${Math.round(entry.duration)}ms (${entry.name})`,
                data: {
                  durationMs: Math.round(entry.duration),
                  name: entry.name,
                },
              });
            } catch {
              // Sentry not initialized yet (e.g. dev build) — ignore.
            }
          }
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    defaultLogger.app.perf.longTaskInitFailed(error);
  }
}

function installIntervalCensus() {
  setInterval(() => {
    const census = getTimerCensus();
    if (census.totalLive === 0) return;
    defaultLogger.app.perf.intervalCensus(census);
  }, INTERVAL_CENSUS_DUMP_MS);
}

function installExportLogsListener() {
  const desktopApi = globalThis.desktopApi;
  if (!desktopApi || typeof desktopApi.on !== 'function') return;
  desktopApi.on(ipcMessageKeys.CPU_WATCHDOG_OPEN_EXPORT_LOGS, () => {
    void (async () => {
      try {
        // Defensive: ensure the locale bundle has loaded before calling
        // appLocale.intl.formatMessage; otherwise the title would degrade
        // to the raw translation key.
        await appLocale.isReady;
        showExportLogsDialog({
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          title: appLocale.intl.formatMessage({
            id: ETranslations.settings_upload_state_logs,
          }),
        });
      } catch (error) {
        defaultLogger.app.perf.longTaskInitFailed(error);
      }
    })();
  });
}
