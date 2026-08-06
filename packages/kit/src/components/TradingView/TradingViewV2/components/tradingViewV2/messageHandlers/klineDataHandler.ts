import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MESSAGE_TYPES } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/constants/messageTypes';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import type { ITradingViewKLineMockEmptyInterval } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  formatBalance,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IMarketAccountTokenTransaction,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import { captureTradingViewRequestTarget } from './tradingViewRequestTarget';
import { sendVolumeVisibilityUpdate } from './volumeVisibilityHandler';

import type { IMessageHandlerContext, IMessageHandlerParams } from './types';

const MAX_MARKS_COUNT = 60;
const DEFAULT_HISTORY_RESPONSE_POINT_COUNT = 300;
const MAX_HISTORY_RESPONSE_POINT_COUNT = 2000;
export const DEFAULT_TRADING_VIEW_KLINE_RESOLUTION = '1m';

export function normalizeTradingViewKLineInterval(
  interval: string,
): ITradingViewKLineMockEmptyInterval | string {
  switch (interval) {
    case '1':
    case '1m':
      return '1m';
    case '3':
    case '3m':
      return '3m';
    case '5':
    case '5m':
      return '5m';
    case '15':
    case '15m':
      return '15m';
    case '30':
    case '30m':
      return '30m';
    case '60':
    case '1h':
    case '1H':
      return '1H';
    case '120':
    case '2h':
    case '2H':
      return '2H';
    case '240':
    case '4h':
    case '4H':
      return '4H';
    case '480':
    case '8h':
    case '8H':
      return '8H';
    case '720':
    case '12h':
    case '12H':
      return '12H';
    case '1d':
    case '1D':
      return '1D';
    case '3d':
    case '3D':
      return '3D';
    case '1w':
    case '1W':
      return '1W';
    case '1M':
      return '1M';
    default:
      return interval;
  }
}

export async function shouldMockEmptyKLineData(resolution?: string) {
  if (!resolution) {
    return false;
  }

  const devSettings =
    await backgroundApiProxy.serviceDevSetting.getDevSetting();

  if (
    !devSettings.enabled ||
    !devSettings.settings?.mockTradingViewKLineEmptyEnabled
  ) {
    return false;
  }

  const selectedInterval =
    devSettings.settings.mockTradingViewKLineEmptyIntervals ?? [];

  return selectedInterval.some(
    (interval) =>
      normalizeTradingViewKLineInterval(resolution) ===
      normalizeTradingViewKLineInterval(interval),
  );
}

function buildEmptyKLineData({
  noData,
  error,
}: {
  noData: boolean;
  error?: string;
}): IMarketTokenKLineResponse {
  return {
    points: [],
    total: 0,
    historyMeta: {
      noData,
      ...(error ? { error } : {}),
    },
  };
}

function getKLineIntervalSeconds(interval: string) {
  const normalizedInterval = normalizeTradingViewKLineInterval(interval);
  const match = normalizedInterval.match(/^(\d+)([mHDWMy])$/);
  if (!match) {
    return undefined;
  }

  const [, count, unit] = match;
  const secondsByUnit = {
    m: 60,
    H: 60 * 60,
    D: 24 * 60 * 60,
    W: 7 * 24 * 60 * 60,
    M: 30 * 24 * 60 * 60,
    y: 365 * 24 * 60 * 60,
  } as const;
  return Number(count) * secondsByUnit[unit as keyof typeof secondsByUnit];
}

function constrainKLineDataToHistoryRequest({
  data,
  to,
  targetCount,
}: {
  data: IMarketTokenKLineResponse;
  to: number;
  targetCount: number;
}): IMarketTokenKLineResponse {
  const pointsByTimestamp = new Map(
    data.points
      .filter((point) => point.t < to)
      .map((point) => [point.t, point] as const),
  );
  const eligiblePoints = Array.from(pointsByTimestamp.values()).toSorted(
    (a, b) => a.t - b.t,
  );
  const points = eligiblePoints.slice(-targetCount);
  const omittedOlderPoints = eligiblePoints.length > points.length;

  return {
    ...data,
    points,
    total: points.length,
    ...(data.historyMeta
      ? {
          historyMeta: {
            ...data.historyMeta,
            noData: data.historyMeta.noData && !omittedOlderPoints,
            isPartial:
              !(data.historyMeta.noData && !omittedOlderPoints) &&
              points.length < targetCount,
            requestedCount: targetCount,
            returnedCount: points.length,
          },
        }
      : {}),
  };
}

function getHistoryTargetCount({
  countBack,
  from,
  to,
  resolution,
}: {
  countBack: unknown;
  from: number;
  to: number;
  resolution: string;
}) {
  if (
    typeof countBack === 'number' &&
    Number.isFinite(countBack) &&
    countBack > 0
  ) {
    return Math.min(
      MAX_HISTORY_RESPONSE_POINT_COUNT,
      Math.max(1, Math.floor(countBack)),
    );
  }

  const intervalSeconds = getKLineIntervalSeconds(resolution) ?? 60;
  return Math.min(
    DEFAULT_HISTORY_RESPONSE_POINT_COUNT,
    Math.max(1, Math.ceil((to - from) / intervalSeconds)),
  );
}

function getKLineErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return undefined;
}

function sendKLineHistoryErrorTerminal({
  webView,
  requestData,
  targetCount,
  error,
}: {
  webView: IWebViewRef;
  requestData: unknown;
  targetCount: number;
  error: string;
}) {
  const kLineData = buildEmptyKLineData({ noData: false, error });
  webView.sendMessageViaInjectedScript({
    type: 'kLineData',
    payload: {
      type: 'history',
      kLineData,
      historyMeta: {
        ...kLineData.historyMeta,
        requestedCount: targetCount,
        returnedCount: 0,
      },
      requestData,
    },
  });
}

function formatAmount(amount: string) {
  const result = formatDisplayNumber(formatBalance(amount));
  return typeof result === 'string' ? result : amount;
}

export function buildTransactionMarks({
  transactions,
}: {
  transactions: IMarketAccountTokenTransaction[];
}) {
  const limitedList = transactions
    .slice()
    .filter((tx) => tx.to?.amount && tx.to?.symbol)
    .toSorted((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_MARKS_COUNT);

  return limitedList.map((tx, index) => {
    const isBuy = tx.type === 'buy';
    const label = isBuy ? 'B' : 'S';
    const displayAmount = tx.to.amount;
    const displaySymbol = tx.to.symbol;
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    const text = appLocale.intl.formatMessage(
      {
        id: isBuy
          ? ETranslations.dexmarket_point_buy
          : ETranslations.dexmarket_point_sell,
      },
      {
        Amount: formatAmount(displayAmount),
        From_Token: displaySymbol,
        to_Token: displaySymbol,
      },
    );
    return {
      id: `${tx.hash}-${isBuy ? 'buy' : 'sell'}-${index}`,
      time: Math.floor(tx.timestamp),
      text,
      label,
      color: isBuy ? '#0A7AFF' : '#FF4D4F',
    };
  });
}

export async function fetchAccountTransactionMarks({
  accountAddress,
  tokenAddress,
  networkId,
  from,
  to,
}: {
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  from: number;
  to: number;
}) {
  if (!accountAddress) {
    return [];
  }

  const accountTransactions =
    await backgroundApiProxy.serviceMarketV2.fetchMarketAccountTokenTransactions(
      {
        accountAddress,
        tokenAddress,
        networkId,
        timeFrom: from,
        timeTo: to,
      },
    );

  return buildTransactionMarks({
    transactions: accountTransactions.list ?? [],
  });
}

export function sendClearAccountMarks({
  tokenAddress,
  symbol,
  webRef,
}: {
  tokenAddress: string;
  symbol?: string;
  webRef: IMessageHandlerContext['webRef'];
}) {
  const marksSymbol = symbol || tokenAddress;

  if (!webRef.current || !marksSymbol) {
    return;
  }

  webRef.current.sendMessageViaInjectedScript({
    type: MESSAGE_TYPES.MARKS_UPDATE,
    payload: {
      marks: [],
      symbol: marksSymbol,
      operation: 'clear',
    },
  });
}

export async function fetchAndSendAccountMarks({
  accountAddress,
  tokenAddress,
  networkId,
  from,
  to,
  symbol,
  resolution,
  webRef,
  webViewLoadGeneration,
  isRequestCurrent,
}: {
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  from: number;
  to: number;
  symbol?: string;
  resolution?: string;
  webRef: IMessageHandlerContext['webRef'];
  webViewLoadGeneration?: IMessageHandlerContext['webViewLoadGeneration'];
  isRequestCurrent?: () => boolean;
}) {
  const requestTarget = captureTradingViewRequestTarget({
    webRef,
    webViewLoadGeneration,
    isRequestCurrent,
  });
  if (!requestTarget.isCurrent()) {
    return;
  }

  if (await shouldMockEmptyKLineData(resolution)) {
    if (!requestTarget.isCurrent()) {
      return;
    }
    sendClearAccountMarks({
      tokenAddress,
      symbol,
      webRef,
    });
    return;
  }

  if (!accountAddress) {
    return;
  }
  try {
    if (!requestTarget.isCurrent()) {
      return;
    }
    const marks = await fetchAccountTransactionMarks({
      accountAddress,
      tokenAddress,
      networkId,
      from,
      to,
    });

    if (marks.length > 0) {
      requestTarget.sendMessage({
        type: MESSAGE_TYPES.MARKS_UPDATE,
        payload: {
          marks,
          symbol: symbol || tokenAddress,
          operation: 'replace',
        },
      });
    }
  } catch (error) {
    console.error('Failed to fetch account token transactions:', error);
  }
}

export async function handleKLineDataRequest({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  const {
    tokenAddress = '',
    networkId = '',
    kLineProvider = 'onekey',
    kLineProviderSymbol,
    webRef,
    accountAddress,
    marksTimeRange,
    tokenSymbol,
  } = context;

  // Safely extract history data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'method' in messageData &&
    'resolution' in messageData &&
    'from' in messageData &&
    'to' in messageData
  ) {
    // Extract properties safely with explicit checks
    const safeData = messageData as unknown as Record<string, unknown>;
    if (
      typeof safeData.resolution !== 'string' ||
      !safeData.resolution ||
      typeof safeData.from !== 'number' ||
      !Number.isFinite(safeData.from) ||
      typeof safeData.to !== 'number' ||
      !Number.isFinite(safeData.to) ||
      safeData.to <= safeData.from
    ) {
      return;
    }
    const resolution = safeData.resolution;
    const from = safeData.from;
    const to = safeData.to;
    const isFirstDataRequest = safeData.firstDataRequest === true;
    const targetCount = getHistoryTargetCount({
      countBack: safeData.countBack,
      from,
      to,
      resolution,
    });
    const requestRange = {
      from,
      to,
      countBack: targetCount,
      firstDataRequest: isFirstDataRequest,
    };
    const requestIdentity = {
      symbol: typeof safeData.symbol === 'string' ? safeData.symbol : undefined,
      tokenAddress:
        typeof safeData.tokenAddress === 'string'
          ? safeData.tokenAddress
          : undefined,
      networkId:
        typeof safeData.networkId === 'string' ? safeData.networkId : undefined,
    };
    const requestTarget = captureTradingViewRequestTarget({
      webRef,
      webViewLoadGeneration: context.webViewLoadGeneration,
      isRequestCurrent: () =>
        (context.isRequestIdentityCurrent?.() ?? true) &&
        (context.isCurrentKLineRequest?.(requestIdentity) ?? true),
    });
    const requestWebView = requestTarget.requestWebView;

    if (!requestTarget.isCurrent() || !requestWebView) {
      return;
    }

    if (context.onCurrentKLineResolutionChange) {
      context.onCurrentKLineResolutionChange(resolution);
    } else if (context.currentKLineResolution) {
      context.currentKLineResolution.current = resolution;
    }

    // Track the time range that user has browsed
    if (marksTimeRange) {
      const current = marksTimeRange.current;
      if (current) {
        current.min = Math.min(current.min, from);
        current.max = Math.max(current.max, to);
      } else {
        marksTimeRange.current = { min: from, max: to };
      }
    }

    // Use combined function to get sliced data
    try {
      const shouldForceEmptyKLineData =
        context.forceEmptyKLineData ||
        (await shouldMockEmptyKLineData(resolution));
      const shouldSuppressKLineError = Boolean(context.emptyKLineDataOnError);
      const fetchedKLineData = shouldForceEmptyKLineData
        ? buildEmptyKLineData({ noData: true })
        : await fetchTradingViewV2DataWithSlicing({
            tokenAddress,
            networkId,
            kLineProvider,
            kLineProviderSymbol,
            interval: resolution,
            timeFrom: from,
            timeTo: to,
            targetCount,
            historyStartTime: context.historyStartTime,
            autoHandleError: shouldSuppressKLineError ? false : undefined,
            requestExactRange: true,
            reuseLatestPage: isFirstDataRequest,
            kLineDataFallback: context.kLineDataFallback,
            primaryKLineDataUnavailable: context.primaryKLineDataUnavailable,
            onPrimaryKLineDataUnavailable:
              context.onPrimaryKLineDataUnavailable,
          });
      const shouldUseEmptyKLineData =
        shouldForceEmptyKLineData ||
        (shouldSuppressKLineError && !fetchedKLineData);
      let kLineData = fetchedKLineData;
      if (shouldUseEmptyKLineData) {
        kLineData = buildEmptyKLineData({ noData: true });
      } else if (fetchedKLineData) {
        kLineData = constrainKLineDataToHistoryRequest({
          data: fetchedKLineData,
          to,
          targetCount,
        });
      }
      if (!kLineData) {
        throw new OneKeyLocalError(
          'K-line history request returned no response',
        );
      }
      const isEmptyKLineData = kLineData.points.length === 0;

      if (!requestTarget.isCurrent()) {
        return;
      }

      const noData =
        shouldUseEmptyKLineData || kLineData.historyMeta?.noData === true;
      requestTarget.sendMessage({
        type: 'kLineData',
        payload: {
          type: 'history',
          kLineData,
          historyMeta: {
            ...kLineData.historyMeta,
            noData,
            requestedCount: targetCount,
            returnedCount: kLineData.points.length,
          },
          requestData: messageData,
        },
      });

      sendVolumeVisibilityUpdate({
        allowHide: Boolean(safeData.firstDataRequest),
        kLineData,
        source: 'history',
        symbol: (safeData.symbol as string) || tokenSymbol || tokenAddress,
        webRef,
      });

      if (isEmptyKLineData) {
        if (isFirstDataRequest) {
          context.onKLineLoadError?.({
            status: 'empty',
            period: normalizeTradingViewKLineInterval(resolution),
            requestRange,
          });
        }
        if (shouldUseEmptyKLineData) {
          sendClearAccountMarks({
            tokenAddress,
            symbol: (safeData.symbol as string) || tokenAddress,
            webRef,
          });
        }
      }

      if (!isEmptyKLineData) {
        context.onKLineDataReady?.({
          period: normalizeTradingViewKLineInterval(resolution),
          requestRange,
        });
      }

      if (
        !shouldUseEmptyKLineData &&
        context.isKLineHistoryReady &&
        accountAddress &&
        tokenAddress &&
        networkId
      ) {
        void fetchAndSendAccountMarks({
          accountAddress,
          tokenAddress,
          networkId,
          from,
          to,
          symbol: (safeData.symbol as string) || tokenAddress,
          resolution,
          webRef,
          webViewLoadGeneration: context.webViewLoadGeneration,
          isRequestCurrent: requestTarget.isCurrent,
        });
      }
    } catch (error) {
      if (!requestTarget.isCurrent()) {
        return;
      }
      context.onKLineLoadError?.({
        status: 'failed',
        period: normalizeTradingViewKLineInterval(resolution),
        message: getKLineErrorMessage(error),
        requestRange,
      });
      const errorMessage =
        getKLineErrorMessage(error) ?? 'Failed to load K-line history';
      sendKLineHistoryErrorTerminal({
        webView: requestWebView,
        requestData: messageData,
        targetCount,
        error: errorMessage,
      });
      console.error('Failed to fetch and send kline data:', error);
    }
  }
}
