import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ChartWebView } from '../ChartWebView';
import { useTradingViewUrl } from '../hooks';

import {
  CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS,
  buildRestoreStorageMessage,
  nextChartMigrationRequestId,
  parseRestoreAck,
} from './utils';

import type { IWebViewRef } from '../../WebView/types';
import type { ICustomReceiveHandlerData } from '../TradingViewV2/types';

/**
 * Restore phase host (Part D4) — shared by iOS + Desktop.
 *
 * Mounts an OFFSCREEN offline ChartWebView (the new origin). On the chart's
 * first `onLoadEnd`, sends a single `RESTORE_STORAGE` message carrying the
 * exported `tradingview_*` blob and waits for the bundle's
 * `tradingview_restoreStorageResult` ack. ONLY on ack `ok=true` does it mark the
 * migration `done` and clear the blob (never fire-and-forget). On any other
 * outcome the state stays `restore-pending` and is retried on the next chart
 * load / launch (idempotent on the chart side via requestId / done marker).
 *
 * NOTE: this reuses the SAME pooled offline WebView origin as the visible chart,
 * so the keys it writes land in the storage the real chart reads.
 */
export function ChartMigrationRestoreHost({
  blob,
}: {
  blob: Record<string, string>;
}) {
  const webRef = useRef<IWebViewRef | null>(null);
  const sentRef = useRef(false);
  const requestIdRef = useRef<string>('');
  const doneRef = useRef(false);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline restore boots a neutral market chart (token-independent); the data
  // it shows is irrelevant — we only need the offline origin loaded so its
  // localStorage is writable. onlineUrl is the network fallback (asset-less
  // builds), matching every other chart host.
  const { params, finalUrl } = useTradingViewUrl({
    additionalParams: {
      symbol: 'BTC',
      type: 'market',
    },
  });

  const sendRestore = useCallback(() => {
    if (sentRef.current || doneRef.current) {
      return;
    }
    const ref = webRef.current;
    if (!ref) {
      return;
    }
    sentRef.current = true;
    const requestId = nextChartMigrationRequestId();
    requestIdRef.current = requestId;
    defaultLogger.market.chart.chartSource({
      platform: platformEnv.appPlatform ?? 'native',
      mode: 'offline',
      sourceKind: 'offline',
    });
    ref.sendMessageViaInjectedScript(
      buildRestoreStorageMessage({ requestId, items: blob }),
    );
    // If the ack never arrives this session, allow a retry on the next load by
    // clearing the sent flag (state stays restore-pending in SimpleDB).
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
    }
    ackTimerRef.current = setTimeout(() => {
      if (!doneRef.current) {
        sentRef.current = false;
      }
    }, CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS);
  }, [blob]);

  const handleLoadEnd = useCallback(() => {
    sendRestore();
  }, [sendRestore]);

  const customReceiveHandler = useCallback(
    async (data: ICustomReceiveHandlerData) => {
      if (doneRef.current) {
        return;
      }
      const ack = parseRestoreAck(data);
      if (!ack) {
        return;
      }
      // Match our request (defensive — the bundle echoes the requestId).
      if (ack.requestId && ack.requestId !== requestIdRef.current) {
        return;
      }
      if (ack.ok) {
        doneRef.current = true;
        if (ackTimerRef.current) {
          clearTimeout(ackTimerRef.current);
        }
        await backgroundApiProxy.serviceApp.setTradingViewChartMigrationDone();
      }
    },
    [],
  );

  const handleWebViewRef = useCallback((ref: IWebViewRef | null) => {
    webRef.current = ref;
  }, []);

  useEffect(() => {
    return () => {
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
      }
    };
  }, []);

  const chart = useMemo(
    () => (
      <ChartWebView
        params={params}
        onlineUrl={finalUrl}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={handleWebViewRef}
        onLoadEnd={handleLoadEnd}
        // selfDrivenSymbol keeps the host from auto-driving SYMBOL_CHANGE — we
        // only care about loading the origin, not showing a specific token.
        selfDrivenSymbol
        flex={1}
      />
    ),
    [params, finalUrl, customReceiveHandler, handleWebViewRef, handleLoadEnd],
  );

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
      {chart}
    </Stack>
  );
}

export default ChartMigrationRestoreHost;
