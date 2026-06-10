import { useCallback, useEffect, useRef } from 'react';

import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ChartMigrationRestoreHost } from './RestoreHost';
import { useChartMigration } from './useChartMigration';
import {
  CHART_MIGRATION_EXPORT_INJECTED_JS,
  CHART_MIGRATION_EXPORT_TIMEOUT_MS,
} from './utils';

import type { WebViewMessageEvent } from 'react-native-webview';

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
});

// The OLD online chart origin (where the legacy localStorage lives). iOS shares
// the default WKWebsiteDataStore between this export webview and the offline
// chart, so reading here then restoring into the offline origin moves the data.
const OLD_ORIGIN_URL = platformEnv.isProduction
  ? TRADING_VIEW_URL
  : TRADING_VIEW_URL_TEST;

/**
 * Export phase host (Part D3, iOS) — mounts an OFFSCREEN raw react-native-webview
 * pointed at the OLD online origin, dumps every `tradingview*` localStorage key
 * via `injectedJavaScriptBeforeContentLoaded` + `postMessage`, then advances the
 * migration state. Needs network ONCE. On failure/timeout it only updates
 * `lastAttemptAt` (state stays `export-deferred`, retried next launch).
 */
function ExportHost() {
  const settledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    if (settledRef.current) {
      return;
    }
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        items?: Record<string, string>;
      };
      if (parsed?.type !== 'CHART_MIGRATION_EXPORT') {
        return;
      }
      settledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      void backgroundApiProxy.serviceApp.setTradingViewChartMigrationExported({
        blob: parsed.items ?? {},
      });
    } catch {
      // ignore malformed messages — the timeout below covers a stuck export.
    }
  }, []);

  const fail = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    void backgroundApiProxy.serviceApp.markTradingViewChartMigrationAttempt();
  }, []);

  useEffect(() => {
    // Diagnostic: the offscreen export webview is mounting against the old
    // origin — the export phase is starting (iOS).
    defaultLogger.market.chart.chartMigration({
      platform: platformEnv.appPlatform ?? 'native',
      event: 'export-start',
    });
    timerRef.current = setTimeout(fail, CHART_MIGRATION_EXPORT_TIMEOUT_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [fail]);

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <WebView
        source={{ uri: OLD_ORIGIN_URL }}
        injectedJavaScriptBeforeContentLoaded={
          CHART_MIGRATION_EXPORT_INJECTED_JS
        }
        onMessage={onMessage}
        onError={fail}
        onHttpError={fail}
        // Content-only: no OneKey bridge, no cookies/cache mutation beyond load.
        cacheEnabled
        javaScriptEnabled
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Global TradingView chart-data migration host (Part D, iOS). Drives at most one
 * phase per launch (export OR restore); renders nothing in the `idle` case.
 */
export function ChartMigration() {
  const { phase, blob } = useChartMigration();
  if (phase === 'export') {
    return <ExportHost />;
  }
  if (phase === 'restore' && blob) {
    return <ChartMigrationRestoreHost blob={blob} />;
  }
  return null;
}

export default ChartMigration;
