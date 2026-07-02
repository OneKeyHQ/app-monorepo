import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import type { IWebViewRef } from '../../WebView/types';

const CHART_PROTOCOL = 'onekey-chart';
const CHART_PROTOCOL_VERSION = 1;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

type IChartProtocolDirection = 'app-to-page' | 'page-to-app';

interface IChartProtocolBase {
  protocol: typeof CHART_PROTOCOL;
  version: typeof CHART_PROTOCOL_VERSION;
  direction: IChartProtocolDirection;
  seq: number;
}

interface IChartProtocolRequest extends IChartProtocolBase {
  direction: 'app-to-page';
  id: string;
  method: string;
  params?: unknown;
}

interface IChartProtocolNotification extends IChartProtocolBase {
  method: string;
  params?: unknown;
}

interface IChartProtocolResponse extends IChartProtocolBase {
  direction: 'page-to-app';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export type IChartProtocolMessage =
  | IChartProtocolNotification
  | IChartProtocolResponse;

type IChartProtocolPending = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

let requestSeq = 0;

function nextSeq(): number {
  requestSeq += 1;
  return requestSeq;
}

function normalizeMessage(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function extractChartProtocolMessage(
  payload: unknown,
): IChartProtocolMessage | undefined {
  const normalizedPayload = normalizeMessage(payload);
  const payloadRecord = asRecord(normalizedPayload);
  const candidates = [
    normalizedPayload,
    payloadRecord?.data,
    asRecord(payloadRecord?.data)?.data,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeMessage(candidate);
    const record = asRecord(normalizedCandidate);
    if (
      record?.protocol === CHART_PROTOCOL &&
      record.version === CHART_PROTOCOL_VERSION &&
      record.direction === 'page-to-app' &&
      typeof record.seq === 'number'
    ) {
      return record as unknown as IChartProtocolMessage;
    }
  }

  return undefined;
}

function createRequest(
  method: string,
  params?: unknown,
): IChartProtocolRequest {
  const seq = nextSeq();
  return {
    protocol: CHART_PROTOCOL,
    version: CHART_PROTOCOL_VERSION,
    direction: 'app-to-page',
    seq,
    id: `chart-${Date.now()}-${seq}`,
    method,
    params,
  };
}

function createNotification(
  method: string,
  params?: unknown,
): IChartProtocolNotification {
  return {
    protocol: CHART_PROTOCOL,
    version: CHART_PROTOCOL_VERSION,
    direction: 'app-to-page',
    seq: nextSeq(),
    method,
    params,
  };
}

export function useChartProtocolBridge({
  webRef,
  enabled,
  onRuntimeReady,
  onWidgetReady,
  onFeatureReady,
  onRenderReady,
}: {
  webRef: RefObject<IWebViewRef | null>;
  enabled: boolean;
  onRuntimeReady?: (params: unknown) => void;
  onWidgetReady?: (params: unknown) => void;
  onFeatureReady?: (params: unknown) => void;
  onRenderReady?: (params: unknown) => void;
}) {
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);
  const pendingRef = useRef<Map<string, IChartProtocolPending>>(new Map());

  useEffect(() => {
    if (enabled) {
      return;
    }
    setIsRuntimeReady(false);
  }, [enabled]);

  useEffect(
    () => () => {
      pendingRef.current.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chart protocol bridge disposed.'));
      });
      pendingRef.current.clear();
    },
    [],
  );

  const sendNotification = useCallback(
    (method: string, params?: unknown) => {
      if (!enabled || !webRef.current) {
        return;
      }
      webRef.current.sendMessageViaInjectedScript(
        createNotification(method, params),
      );
    },
    [enabled, webRef],
  );

  const sendRequest = useCallback(
    (
      method: string,
      params?: unknown,
      timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ) =>
      new Promise<unknown>((resolve, reject) => {
        if (!enabled || !webRef.current) {
          reject(new Error('Chart protocol bridge is not enabled.'));
          return;
        }

        const request = createRequest(method, params);
        const timer = setTimeout(() => {
          pendingRef.current.delete(request.id);
          reject(new Error(`Chart protocol request timed out: ${method}`));
        }, timeoutMs);
        pendingRef.current.set(request.id, {
          resolve,
          reject,
          timer,
        });
        webRef.current.sendMessageViaInjectedScript(request);
      }),
    [enabled, webRef],
  );

  const handleProtocolMessage = useCallback(
    (payload: unknown): boolean => {
      const message = extractChartProtocolMessage(payload);
      if (!message) {
        return false;
      }

      if ('id' in message) {
        const pending = pendingRef.current.get(message.id);
        if (!pending) {
          return true;
        }
        pendingRef.current.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok) {
          pending.resolve(message.result);
        } else {
          pending.reject(
            new Error(
              message.error?.message || 'Chart protocol request failed.',
            ),
          );
        }
        return true;
      }

      switch (message.method) {
        case 'chart.runtimeReady':
          setIsRuntimeReady(true);
          onRuntimeReady?.(message.params);
          return true;
        case 'chart.widgetReady':
          onWidgetReady?.(message.params);
          return true;
        case 'chart.featureReady':
          onFeatureReady?.(message.params);
          return true;
        case 'chart.renderReady':
          onRenderReady?.(message.params);
          return true;
        default:
          return true;
      }
    },
    [onFeatureReady, onRenderReady, onRuntimeReady, onWidgetReady],
  );

  return {
    handleProtocolMessage,
    isRuntimeReady: enabled && isRuntimeReady,
    sendNotification,
    sendRequest,
  };
}
