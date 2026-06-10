import { useCallback, useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';

import { ChartMigrationRestoreHost } from './RestoreHost';
import { useChartMigration } from './useChartMigration';
import {
  CHART_MIGRATION_EXPORT_EVAL_JS,
  CHART_MIGRATION_EXPORT_TIMEOUT_MS,
} from './utils';

import type { IElectronWebView, IWebViewRef } from '../../WebView/types';

// The OLD online chart origin (where the legacy localStorage lives). Desktop's
// chart `<webview>` runs on the shared `persist:onekey` partition, so the export
// webview must pin that same partition to read the legacy keys.
const OLD_ORIGIN_URL = platformEnv.isProduction
  ? TRADING_VIEW_URL
  : TRADING_VIEW_URL_TEST;

type IElectronWebViewWithEval = Omit<IElectronWebView, 'executeJavaScript'> & {
  // Electron's executeJavaScript returns a promise resolving to the script's
  // value; the kit type annotates it as void, so override it here (Omit first
  // so the return type is a clean Promise, not an intersection overload).
  executeJavaScript: (code: string) => Promise<unknown>;
};

/**
 * Export phase host (Part D3, Desktop) — mounts a HIDDEN electron `<webview>` on
 * the `persist:onekey` partition pointed at the OLD online origin, then reads
 * every `tradingview*` localStorage key via `executeJavaScript` (whose returned
 * value is the JSON dump) and advances the migration state. Needs network ONCE.
 * On failure/timeout it only updates `lastAttemptAt` (state stays
 * `export-deferred`, retried next launch).
 */
function ExportHost() {
  const settledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webRef = useRef<IWebViewRef | null>(null);

  const fail = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    void backgroundApiProxy.serviceApp.markTradingViewChartMigrationAttempt();
  }, []);

  const exportNow = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    // Diagnostic: the hidden export webview reached dom-ready — the export
    // phase is starting (Desktop).
    defaultLogger.market.chart.chartMigration({
      platform: platformEnv.appPlatform ?? 'native',
      event: 'export-start',
    });
    const inner = (webRef.current as unknown as { innerRef?: unknown })
      ?.innerRef as IElectronWebViewWithEval | undefined;
    if (!inner?.executeJavaScript) {
      fail();
      return;
    }
    void (async () => {
      try {
        const raw = await inner.executeJavaScript(
          CHART_MIGRATION_EXPORT_EVAL_JS,
        );
        if (settledRef.current) {
          return;
        }
        const items = (
          typeof raw === 'string' ? JSON.parse(raw) : {}
        ) as Record<string, string>;
        settledRef.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        await backgroundApiProxy.serviceApp.setTradingViewChartMigrationExported(
          { blob: items },
        );
      } catch {
        fail();
      }
    })();
  }, [fail]);

  const handleWebViewRef = useCallback((ref: IWebViewRef | null) => {
    webRef.current = ref;
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(fail, CHART_MIGRATION_EXPORT_TIMEOUT_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [fail]);

  return (
    <Stack
      position="absolute"
      left={-9999}
      top={-9999}
      width={1}
      height={1}
      opacity={0}
      pointerEvents="none"
    >
      <WebView
        src={OLD_ORIGIN_URL}
        partition="persist:onekey"
        // Content-only: do not treat the export page as a DApp (no bridge).
        disableBridge
        onWebViewRef={handleWebViewRef}
        // dom-ready guarantees localStorage is reachable via executeJavaScript.
        onDomReady={exportNow}
        // Fast-fail on network/DNS failure of the old-origin URL so we don't sit
        // idle until the 30s timeout (the native variant already fast-fails via
        // onError/onHttpError). `fail` only marks the attempt + lets the next
        // launch retry; it ignores the event arg so the signature is compatible.
        onDidFailLoad={fail}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
      />
    </Stack>
  );
}

/**
 * Global TradingView chart-data migration host (Part D, Desktop). Drives at most
 * one phase per launch (export OR restore); renders nothing when `idle`.
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
