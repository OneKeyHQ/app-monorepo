import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewKLineMockEmptyInterval } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  formatBalance,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IMarketAccountTokenTransaction,
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { MESSAGE_TYPES } from '../../TradingViewPerpsV2/constants/messageTypes';
// Import directly from the source module (not the `../hooks` barrel) to avoid an
// import cycle: hooks/index -> useTradingViewV2WebSocket -> this file -> hooks/index.
import { fetchTradingViewV2DataWithSlicing } from '../hooks/useTradingViewV2';

import type { IMessageHandlerContext, IMessageHandlerParams } from './types';

const MAX_MARKS_COUNT = 60;
export const DEFAULT_TRADING_VIEW_KLINE_RESOLUTION = '1m';

export function normalizeTradingViewKLineInterval(
  interval: string,
): ITradingViewKLineMockEmptyInterval | string {
  switch (interval) {
    case '1':
    case '1m':
      return '1m';
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
    case '240':
    case '4h':
    case '4H':
      return '4H';
    case '1d':
    case '1D':
      return '1D';
    case '1w':
    case '1W':
      return '1W';
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

function buildEmptyKLineData(): IMarketTokenKLineResponse {
  return {
    points: [],
    total: 0,
  };
}

// Q2 FIX: the market kline API (/utility/v2/market/token/kline) returns each bar
// as { c: "<string close>", t } — only a STRING close + timestamp, no numeric
// o/h/l/v. The chart page's datafeed expects numeric OHLCV, so the candles never
// render (the y-axis collapses to a default ~[-0.4, 0.6] empty scale). Normalize
// every bar to numeric o/h/l/c/v: parse strings to numbers, and when o/h/l are
// absent synthesize them from the close (flat bar) and default v to 0. Safe no-op
// when the API already returns full numeric OHLCV. Returns the count of bars that
// needed OHLC synthesis so we can flag a backend gap in the logs.
export function normalizeKLineForPage(data: IMarketTokenKLineResponse): {
  data: IMarketTokenKLineResponse;
  synthesizedOHLC: number;
} {
  let synthesizedOHLC = 0;
  const toNum = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const points = (data.points ?? [])
    .map((raw): IMarketTokenKLineDataPoint | null => {
      const p = raw as unknown as Record<string, unknown>;
      const t = toNum(p.t);
      // Drop bars with a non-numeric timestamp: a NaN/0 `t` would place the bar
      // at epoch 1970 and corrupt the chart's time axis.
      if (t === undefined) {
        return null;
      }
      const c = toNum(p.c) ?? 0;
      let o = toNum(p.o);
      let h = toNum(p.h);
      let l = toNum(p.l);
      const v = toNum(p.v) ?? 0;
      if (o === undefined || h === undefined || l === undefined) {
        synthesizedOHLC += 1;
        o = o ?? c;
        h = h ?? c;
        l = l ?? c;
      }
      return { o, h, l, c, v, t } as IMarketTokenKLineDataPoint;
    })
    .filter((point): point is IMarketTokenKLineDataPoint => point !== null);
  return { data: { points, total: data.total }, synthesizedOHLC };
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

export async function fetchAndSendAccountMarks({
  accountAddress,
  tokenAddress,
  networkId,
  from,
  to,
  symbol,
  resolution,
  webRef,
}: {
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  from: number;
  to: number;
  symbol?: string;
  resolution?: string;
  webRef: IMessageHandlerContext['webRef'];
}) {
  if (await shouldMockEmptyKLineData(resolution)) {
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
    const marks = await fetchAccountTransactionMarks({
      accountAddress,
      tokenAddress,
      networkId,
      from,
      to,
    });

    if (webRef.current && marks.length > 0) {
      webRef.current.sendMessageViaInjectedScript({
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

export async function handleKLineDataRequest({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  const {
    tokenAddress = '',
    networkId = '',
    webRef,
    accountAddress,
    marksTimeRange,
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
    const resolution = safeData.resolution as string;
    const from = safeData.from as number;
    const to = safeData.to as number;

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
        ? buildEmptyKLineData()
        : await fetchTradingViewV2DataWithSlicing({
            tokenAddress,
            networkId,
            interval: resolution,
            timeFrom: from,
            timeTo: to,
            autoHandleError: shouldSuppressKLineError ? false : undefined,
            kLineDataFallback: context.kLineDataFallback,
            primaryKLineDataUnavailable: context.primaryKLineDataUnavailable,
            onPrimaryKLineDataUnavailable:
              context.onPrimaryKLineDataUnavailable,
          });
      const shouldUseEmptyKLineData =
        shouldForceEmptyKLineData ||
        (shouldSuppressKLineError && !fetchedKLineData);
      const rawKLineData = shouldUseEmptyKLineData
        ? buildEmptyKLineData()
        : fetchedKLineData;

      // Q2 FIX: normalize to numeric OHLCV before handing bars to the page.
      const normalized = rawKLineData
        ? normalizeKLineForPage(rawKLineData)
        : undefined;
      const kLineData = normalized?.data ?? rawKLineData;

      if (webRef.current && kLineData) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'kLineData',
          payload: {
            type: 'history',
            kLineData,
            requestData: messageData,
          },
        });
      }

      if (shouldUseEmptyKLineData) {
        sendClearAccountMarks({
          tokenAddress,
          symbol: (safeData.symbol as string) || tokenAddress,
          webRef,
        });
      }

      if (
        !shouldUseEmptyKLineData &&
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
        });
      }
    } catch (error) {
      console.error('Failed to fetch and send kline data:', error);
    }
  }
}
