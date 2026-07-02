import { useCallback, useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';
import { useTradingViewUrl } from '../hooks';

import { useChartMigration } from './useChartMigration';
import {
  CHART_MIGRATION_EXPORT_EVAL_JS,
  CHART_MIGRATION_EXPORT_TIMEOUT_MS,
  CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS,
  buildRestoreStorageMessage,
  nextChartMigrationRequestId,
  parseRestoreAck,
} from './utils';

import type { IElectronWebView, IWebViewRef } from '../../WebView/types';

const OLD_ORIGIN_URL = platformEnv.isProduction
  ? TRADING_VIEW_URL
  : TRADING_VIEW_URL_TEST;

type IElectronWebViewWithEval = Omit<IElectronWebView, 'executeJavaScript'> & {
  executeJavaScript: (code: string) => Promise<unknown>;
};

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
        disableBridge
        onWebViewRef={handleWebViewRef}
        onDomReady={exportNow}
        onDidFailLoad={fail}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
      />
    </Stack>
  );
}

function RestoreHost({ blob }: { blob: Record<string, string> }) {
  const webRef = useRef<IWebViewRef | null>(null);
  const sentRef = useRef(false);
  const doneRef = useRef(false);
  const requestIdRef = useRef<string>('');
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { finalUrl } = useTradingViewUrl({
    additionalParams: {
      symbol: 'BTC',
      type: 'market',
      storageNamespace: 'market',
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

    const requestId = nextChartMigrationRequestId();
    requestIdRef.current = requestId;
    ref.sendMessageViaInjectedScript(
      buildRestoreStorageMessage({ requestId, items: blob }),
    );
    sentRef.current = true;

    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
    }
    ackTimerRef.current = setTimeout(() => {
      if (!doneRef.current) {
        sentRef.current = false;
      }
    }, CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS);
  }, [blob]);

  const customReceiveHandler = useCallback(async (payload: unknown) => {
    if (doneRef.current) {
      return;
    }

    const ack = parseRestoreAck(payload);
    if (!ack) {
      return;
    }

    if (ack.requestId !== undefined && ack.requestId !== requestIdRef.current) {
      return;
    }
    if (ack.requestId === undefined && !sentRef.current) {
      return;
    }

    if (ack.ok) {
      doneRef.current = true;
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
      }
      await backgroundApiProxy.serviceApp.setTradingViewChartMigrationDone();
    }
  }, []);

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
  const { phase, blob } = useChartMigration();

  if (phase === 'export') {
    return <ExportHost />;
  }

  if (phase === 'restore' && blob) {
    return <RestoreHost blob={blob} />;
  }

  return null;
}

export default ChartMigration;
