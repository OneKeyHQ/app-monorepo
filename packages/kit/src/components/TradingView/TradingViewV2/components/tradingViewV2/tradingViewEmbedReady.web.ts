import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const TRADING_VIEW_CHART_READY_METHOD = 'tradingview_chartReady';
const TRADING_VIEW_CHART_ERROR_METHOD = 'tradingview_chartError';

interface ITradingViewEmbedReadyMonitor {
  cancel(): void;
  notify(payload: unknown): boolean;
  wait(timeoutMs?: number): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTradingViewChartReadyPayload(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    payload.scope === '$private' &&
    payload.method === TRADING_VIEW_CHART_READY_METHOD
  );
}

export function isTradingViewChartErrorPayload(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    payload.scope === '$private' &&
    payload.method === TRADING_VIEW_CHART_ERROR_METHOD
  );
}

export function createTradingViewEmbedReadyMonitor(): ITradingViewEmbedReadyMonitor {
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((error: Error) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const resolve = () => {
    if (settled) {
      return;
    }
    settled = true;
    if (timeout) {
      clearTimeout(timeout);
    }
    resolvePromise?.();
  };

  const reject = (error: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    if (timeout) {
      clearTimeout(timeout);
    }
    rejectPromise?.(error);
  };

  return {
    cancel: resolve,
    notify(payload) {
      if (isTradingViewChartReadyPayload(payload)) {
        resolve();
        return true;
      }
      if (isTradingViewChartErrorPayload(payload)) {
        reject(
          new OneKeyLocalError('TradingView embed chart initialization failed'),
        );
        return true;
      }
      return false;
    },
    wait(timeoutMs) {
      if (!settled && !timeout && timeoutMs !== undefined) {
        timeout = setTimeout(() => {
          if (settled) {
            return;
          }
          reject(
            new OneKeyLocalError('TradingView embed chart ready timed out'),
          );
        }, timeoutMs);
      }
      return promise;
    },
  };
}
