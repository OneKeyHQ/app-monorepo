// Shared helpers for the TradingView cross-origin chart-data migration host
// (Part D, iOS + Desktop only). The migration moves the legacy `tradingview_*`
// localStorage keys (written by the previous ONLINE chart on
// `tradingview.onekey.so`) into the NEW offline origin (iOS onekey-chart://,
// desktop onekey-chart://local), which JS cannot read cross-origin. (Android
// reuses the old origin via Part G, so it never runs this migration.)

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getChartWebViewMode } from '../ChartWebView/constants';

// Only iOS + Desktop migrate (Part D). Android reuses the legacy origin.
export const CHART_MIGRATION_PLATFORM_SUPPORTED = Boolean(
  platformEnv.isNativeIOS || platformEnv.isDesktop,
);

/**
 * Migration is allowed only when this build's EFFECTIVE chart mode is `offline`
 * (per Part B2 / Gate 2). The `online` path keeps chart data on the OLD origin,
 * so there is nothing to migrate there. `getChartWebViewMode()` reads the locked
 * cold-start snapshot synchronously.
 */
export function isChartMigrationEffectivelyOffline(): boolean {
  return (
    CHART_MIGRATION_PLATFORM_SUPPORTED && getChartWebViewMode() === 'offline'
  );
}

// Backoff for export retries: at most one export attempt per launch and never
// before this minimum interval has elapsed since the last attempt. There is NO
// attempts cap — a long-offline user keeps retrying until the export succeeds
// (codex#2).
export const CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS = 60 * 1000;

// How long to wait for the (network-dependent) export page to load + dump
// before treating the attempt as failed. Failure only updates `lastAttemptAt`.
export const CHART_MIGRATION_EXPORT_TIMEOUT_MS = 30 * 1000;

// How long to wait for the chart bundle's RESTORE_STORAGE ack before giving up
// for this session (the state stays `restore-pending`, retried next chart load).
export const CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS = 30 * 1000;

// The prefix of every key the chart bundle persists (settings / drawings /
// study templates / interval). We export EVERY key with this prefix.
export const CHART_MIGRATION_KEY_PREFIX = 'tradingview';

/**
 * JS injected into the OLD-origin export page. Runs as early as possible and
 * dumps every `tradingview*` localStorage key (already present from the
 * previous online-chart sessions) back to RN via `ReactNativeWebView.postMessage`.
 * Wrapped so a throw can never break the page. `true;` at the end satisfies
 * react-native-webview's injected-script contract.
 */
export const CHART_MIGRATION_EXPORT_INJECTED_JS = `
(function () {
  try {
    var items = {};
    for (var i = 0; i < window.localStorage.length; i += 1) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf('${CHART_MIGRATION_KEY_PREFIX}') === 0) {
        items[k] = window.localStorage.getItem(k) || '';
      }
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'CHART_MIGRATION_EXPORT', items: items }),
    );
  } catch (e) {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'CHART_MIGRATION_EXPORT', items: {} }),
      );
    } catch (_e) {}
  }
  true;
})();
`;

/**
 * Build the same `tradingview*` dump as an expression whose RESULT is the JSON
 * string — used on desktop, where the electron `<webview>` returns the value of
 * `executeJavaScript` directly (no postMessage transport needed).
 */
export const CHART_MIGRATION_EXPORT_EVAL_JS = `
(function () {
  try {
    var items = {};
    for (var i = 0; i < window.localStorage.length; i += 1) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf('${CHART_MIGRATION_KEY_PREFIX}') === 0) {
        items[k] = window.localStorage.getItem(k) || '';
      }
    }
    return JSON.stringify(items);
  } catch (e) {
    return '{}';
  }
})();
`;

let requestIdSeq = 0;
export function nextChartMigrationRequestId(): string {
  requestIdSeq += 1;
  return `chart-migration-restore-${Date.now()}-${requestIdSeq}`;
}

/**
 * Build the RESTORE_STORAGE message sent to the offline chart bundle (Part D4).
 *
 * ⚠️ DECISION: `currentStorageVersion` is intentionally OMITTED. With it absent,
 * the chart handler leaves `tradingview_storage_version` unset and `main.tsx`
 * self-stamps the running bundle version on reload — so no version-mismatch
 * clear is triggered (which would otherwise wipe the just-restored keys, incl.
 * `tradingview_interval_*`). See the plan / runbook Part D4.
 */
export function buildRestoreStorageMessage(params: {
  requestId: string;
  items: Record<string, string>;
}) {
  return {
    type: 'RESTORE_STORAGE',
    requestId: params.requestId,
    payload: {
      version: 1,
      items: params.items,
      // currentStorageVersion: INTENTIONALLY OMITTED — see note above.
    },
  };
}

// Shape of the chart bundle's restore ack (Part D4).
export type IChartMigrationRestoreAck = {
  scope: '$private';
  method: 'tradingview_restoreStorageResult';
  data: {
    requestId?: string;
    ok?: boolean;
    restoredCount?: number;
    skippedKeys?: string[];
    error?: string;
  };
};

/**
 * Recognize the chart bundle's restore ack from a raw `customReceiveHandler`
 * payload (the message handler delivers `{ data: <payload> }`).
 */
export function parseRestoreAck(
  payload: unknown,
): IChartMigrationRestoreAck['data'] | undefined {
  const data = (payload as { data?: unknown })?.data as
    | IChartMigrationRestoreAck
    | undefined;
  if (
    data &&
    data.scope === '$private' &&
    data.method === 'tradingview_restoreStorageResult'
  ) {
    return data.data;
  }
  return undefined;
}
