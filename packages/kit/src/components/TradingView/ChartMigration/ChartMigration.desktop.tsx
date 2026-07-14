import { useCallback, useEffect, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';

import WebView from '../../WebView';
import { EDesktopWebViewPreloadKind } from '../../WebView/types';
import { useTradingViewUrl } from '../hooks';
import { useChartProtocolBridge } from '../protocol/useChartProtocolBridge';

import { useChartMigration } from './useChartMigration';
import {
  CHART_MIGRATION_EXPORT_EVAL_JS,
  CHART_MIGRATION_EXPORT_TIMEOUT_MS,
  CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS,
  CHART_MIGRATION_RESTORE_MAX_SESSION_ATTEMPTS,
  CHART_MIGRATION_RESTORE_RETRY_DELAY_MS,
  buildRestoreStorageMessage,
  mergeChartMigrationExportResults,
  nextChartMigrationRequestId,
  parseChartMigrationExportResult,
  parseRestoreAck,
} from './utils';

import type { IChartMigrationExportResult } from './utils';
import type { IElectronWebView, IWebViewRef } from '../../WebView/types';

const OLD_ORIGIN_URLS = [TRADING_VIEW_URL, TRADING_VIEW_URL_TEST] as const;

type IElectronWebViewWithEval = Omit<IElectronWebView, 'executeJavaScript'> & {
  executeJavaScript: (code: string) => Promise<unknown>;
};

function ExportSourceHost({
  sourceUrl,
  onSettled,
}: {
  sourceUrl: string;
  onSettled: (sourceUrl: string, result: IChartMigrationExportResult) => void;
}) {
  const settledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webRef = useRef<IWebViewRef | null>(null);

  const settle = useCallback(
    (result: IChartMigrationExportResult) => {
      if (settledRef.current) {
        return;
      }
      settledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      onSettled(sourceUrl, result);
    },
    [onSettled, sourceUrl],
  );

  const fail = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settle({ ok: false });
  }, [settle]);

  const exportNow = useCallback(() => {
    if (settledRef.current) {
      return;
    }

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

        settle(parseChartMigrationExportResult(raw));
      } catch {
        fail();
      }
    })();
  }, [fail, settle]);

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
        src={sourceUrl}
        partition="persist:onekey"
        disableBridge
        onWebViewRef={handleWebViewRef}
        onDomReady={exportNow}
        onDidFailLoad={(event) => {
          if (event.isMainFrame && event.errorCode !== -3) {
            fail();
          }
        }}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
      />
    </Stack>
  );
}

function ExportHost({
  onExported,
}: {
  onExported: (items: Record<string, string>) => void;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const resultsRef = useRef<Map<string, IChartMigrationExportResult>>(
    new Map(),
  );
  const finalizedRef = useRef(false);

  const handleSettled = useCallback(
    (sourceUrl: string, result: IChartMigrationExportResult) => {
      if (finalizedRef.current || resultsRef.current.has(sourceUrl)) {
        return;
      }
      resultsRef.current.set(sourceUrl, result);
      if (resultsRef.current.size < OLD_ORIGIN_URLS.length) {
        return;
      }
      finalizedRef.current = true;

      const preferredOrigin = devSettings.enabled
        ? TRADING_VIEW_URL_TEST
        : TRADING_VIEW_URL;
      const mergeOrder = [
        ...OLD_ORIGIN_URLS.filter((url) => url !== preferredOrigin),
        preferredOrigin,
      ];
      const mergedResult = mergeChartMigrationExportResults({
        results: resultsRef.current,
        mergeOrder,
      });

      void (async () => {
        if (!mergedResult.ok) {
          await backgroundApiProxy.serviceApp.markTradingViewChartMigrationAttempt();
          return;
        }
        try {
          await backgroundApiProxy.serviceApp.setTradingViewChartMigrationExported(
            { blob: mergedResult.items },
          );
          onExported(mergedResult.items);
        } catch {
          await backgroundApiProxy.serviceApp.markTradingViewChartMigrationAttempt();
        }
      })();
    },
    [devSettings.enabled, onExported],
  );

  return OLD_ORIGIN_URLS.map((sourceUrl) => (
    <ExportSourceHost
      key={sourceUrl}
      sourceUrl={sourceUrl}
      onSettled={handleSettled}
    />
  ));
}

function RestoreHost({
  blob,
  initialRestoreAttemptCount,
  onRestored,
}: {
  blob: Record<string, string>;
  initialRestoreAttemptCount: number;
  onRestored: () => void;
}) {
  const webRef = useRef<IWebViewRef | null>(null);
  const sentRef = useRef(false);
  const doneRef = useRef(false);
  const disposedRef = useRef(false);
  const attemptCountRef = useRef(initialRestoreAttemptCount);
  const sessionAttemptCountRef = useRef(0);
  const requestIdRef = useRef<string>('');
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const { finalUrl, isOfflineChart } = useTradingViewUrl({
    forceDesktopOfflineChart: true,
    additionalParams: {
      symbol: 'BTC',
      type: 'market',
      storageNamespace: 'market',
    },
  });
  const {
    handleProtocolMessage,
    isRuntimeReady: isChartProtocolRuntimeReady,
    sendRequest: sendChartProtocolRequest,
  } = useChartProtocolBridge({
    webRef,
    enabled: isOfflineChart,
    runtimeKey: finalUrl,
  });

  const completeRestore = useCallback(async () => {
    if (doneRef.current) {
      return;
    }
    await backgroundApiProxy.serviceApp.setTradingViewChartMigrationDone();
    doneRef.current = true;
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    onRestored();
  }, [onRestored]);

  const recordFailureAndScheduleRetry = useCallback(
    (reason: 'ack-timeout' | 'protocol-error') => {
      if (doneRef.current || disposedRef.current) {
        return;
      }
      sentRef.current = false;
      void backgroundApiProxy.serviceApp.markTradingViewChartMigrationRestoreAttempt(
        {
          reason,
          attemptCount: attemptCountRef.current,
        },
      );
      if (
        sessionAttemptCountRef.current >=
        CHART_MIGRATION_RESTORE_MAX_SESSION_ATTEMPTS
      ) {
        return;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = setTimeout(() => {
        setRetryTrigger((value) => value + 1);
      }, CHART_MIGRATION_RESTORE_RETRY_DELAY_MS * sessionAttemptCountRef.current);
    },
    [],
  );

  const sendRestore = useCallback(() => {
    if (
      sentRef.current ||
      doneRef.current ||
      sessionAttemptCountRef.current >=
        CHART_MIGRATION_RESTORE_MAX_SESSION_ATTEMPTS
    ) {
      return;
    }

    const ref = webRef.current;
    if (!ref) {
      return;
    }

    const requestId = nextChartMigrationRequestId();
    requestIdRef.current = requestId;
    const restoreMessage = buildRestoreStorageMessage({
      requestId,
      items: blob,
    });
    if (isOfflineChart) {
      if (!isChartProtocolRuntimeReady) {
        return;
      }
      sentRef.current = true;
      attemptCountRef.current += 1;
      sessionAttemptCountRef.current += 1;
      void sendChartProtocolRequest(
        'chart.restoreStorage',
        { payload: restoreMessage.payload },
        CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS,
      )
        .then(completeRestore)
        .catch((error) => {
          if (!doneRef.current) {
            console.error('[ChartMigration] restoreStorage failed:', error);
            recordFailureAndScheduleRetry('protocol-error');
          }
        });
      return;
    }

    ref.sendMessageViaInjectedScript(restoreMessage);
    sentRef.current = true;
    attemptCountRef.current += 1;
    sessionAttemptCountRef.current += 1;

    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
    }
    ackTimerRef.current = setTimeout(() => {
      if (!doneRef.current) {
        recordFailureAndScheduleRetry('ack-timeout');
      }
    }, CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS);
  }, [
    blob,
    completeRestore,
    isChartProtocolRuntimeReady,
    isOfflineChart,
    recordFailureAndScheduleRetry,
    sendChartProtocolRequest,
  ]);

  useEffect(() => {
    if (!isOfflineChart || isChartProtocolRuntimeReady) {
      sendRestore();
    }
  }, [isChartProtocolRuntimeReady, isOfflineChart, retryTrigger, sendRestore]);

  const customReceiveHandler = useCallback(
    async (payload: unknown) => {
      if (doneRef.current) {
        return;
      }

      if (handleProtocolMessage(payload)) {
        return;
      }

      const ack = parseRestoreAck(payload);
      if (!ack) {
        return;
      }

      if (
        ack.requestId !== undefined &&
        ack.requestId !== requestIdRef.current
      ) {
        return;
      }
      if (ack.requestId === undefined && !sentRef.current) {
        return;
      }

      if (ack.ok) {
        await completeRestore();
      }
    },
    [completeRestore, handleProtocolMessage],
  );

  const handleWebViewRef = useCallback((ref: IWebViewRef | null) => {
    webRef.current = ref;
  }, []);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

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
        src={finalUrl}
        preloadKind={
          isOfflineChart ? EDesktopWebViewPreloadKind.Chart : undefined
        }
        skipBackgroundBridge={isOfflineChart}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={handleWebViewRef}
        onLoadEnd={sendRestore}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
      />
    </Stack>
  );
}

export function ChartMigration() {
  const { phase, blob, restoreAttemptCount, handleExported, handleRestored } =
    useChartMigration();

  if (phase === 'export') {
    return <ExportHost onExported={handleExported} />;
  }

  if (phase === 'restore' && blob) {
    return (
      <RestoreHost
        blob={blob}
        initialRestoreAttemptCount={restoreAttemptCount}
        onRestored={handleRestored}
      />
    );
  }

  return null;
}

export default ChartMigration;
