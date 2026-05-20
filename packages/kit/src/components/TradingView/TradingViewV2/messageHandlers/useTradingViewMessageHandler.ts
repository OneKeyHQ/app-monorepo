import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { calculateDisplayPriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { handleAnalyticsEvent } from './analyticsHandler';
import {
  fetchAccountTransactionMarks,
  handleKLineDataRequest,
  sendClearAccountMarks,
  shouldMockEmptyKLineData,
} from './klineDataHandler';
import { handleLayoutUpdate } from './layoutUpdateHandler';

import type { IMarksTimeRange, IMessageHandlerContext } from './types';
import type { IWebViewRef } from '../../../WebView/types';
import type {
  ICustomReceiveHandlerData,
  ITradingViewIndicatorsDialogData,
  ITradingViewTouchScrollData,
} from '../types';

const DEFAULT_HYPERLIQUID_PRICE_SCALE = 100;

interface IUseTradingViewMessageHandlerParams {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
  accountAddress?: string;
  tokenSymbol?: string;
  marksTimeRange?: React.MutableRefObject<IMarksTimeRange | null>;
  currentKLineResolution?: React.MutableRefObject<string>;
  onTouchScroll?: (deltaY: number) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
}

async function handleGetHyperliquidPriceScale({
  request,
  webRef,
}: {
  request: { symbol?: string; requestId?: string };
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  if (!request.requestId) {
    return;
  }

  const requestSymbol = request.symbol;
  let priceScale = DEFAULT_HYPERLIQUID_PRICE_SCALE;
  let persistedPriceScale: number | undefined;
  let midValue: string | undefined;

  if (!requestSymbol) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
      payload: {
        priceScale,
        minmov: 1,
        requestId: request.requestId,
      },
    });
    return;
  }

  const loadMidPrice = async () => {
    return backgroundApiProxy.serviceHyperliquid.getTradingviewMidPrice(
      requestSymbol,
    );
  };

  midValue = await loadMidPrice();

  if (!midValue && requestSymbol) {
    try {
      persistedPriceScale =
        await backgroundApiProxy.serviceHyperliquid.getTradingviewDisplayPriceScale(
          requestSymbol,
        );
    } catch (error) {
      console.error(
        '[TradingViewV2] Failed to load HyperLiquid price scale:',
        error,
      );
    }
  }

  if (!midValue && persistedPriceScale === undefined) {
    const deadline = Date.now() + timerUtils.getTimeDurationMs({ seconds: 3 });
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      midValue = await loadMidPrice();
      if (midValue) {
        break;
      }
    }
  }

  if (midValue && requestSymbol) {
    priceScale = calculateDisplayPriceScale(midValue);
    try {
      await backgroundApiProxy.serviceHyperliquid.setTradingviewDisplayPriceScale(
        {
          symbol: requestSymbol,
          priceScale,
        },
      );
    } catch (error) {
      console.error(
        '[TradingViewV2] Failed to persist HyperLiquid price scale:',
        error,
      );
    }
  } else if (persistedPriceScale !== undefined) {
    priceScale = persistedPriceScale;
  }

  webRef.current?.sendMessageViaInjectedScript({
    type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
    payload: {
      priceScale,
      minmov: 1,
      requestId: request.requestId,
    },
  });
}

async function handleGetMarks({
  request,
  accountAddress,
  tokenAddress,
  networkId,
  resolution,
  webRef,
}: {
  request: {
    requestId?: string;
    from?: number;
    to?: number;
    symbol?: string;
    resolution?: string;
  };
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  resolution?: string;
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  const requestId = request.requestId;

  if (!requestId) {
    return;
  }

  if (await shouldMockEmptyKLineData(resolution)) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
    sendClearAccountMarks({
      tokenAddress,
      symbol: request.symbol,
      webRef,
    });
    return;
  }

  if (!tokenAddress || !networkId) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
    return;
  }

  try {
    const marks = await fetchAccountTransactionMarks({
      accountAddress,
      tokenAddress,
      networkId,
      from: request.from ?? 0,
      to: request.to ?? Math.floor(Date.now() / 1000),
    });

    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks,
        requestId,
      },
    });
  } catch (error) {
    console.error('[TradingViewV2] Failed to fetch marks:', error);
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
  }
}

function getIndicatorsDialogOpenState(
  dialogData: ITradingViewIndicatorsDialogData | undefined,
): boolean | undefined {
  if (typeof dialogData?.isOpen === 'boolean') {
    return dialogData.isOpen;
  }
  if (dialogData?.action === 'open') {
    return true;
  }
  if (dialogData?.action === 'close') {
    return false;
  }
  return undefined;
}

export function useTradingViewMessageHandler({
  tokenAddress = '',
  networkId = '',
  webRef,
  onPanesCountChange,
  accountAddress,
  tokenSymbol,
  marksTimeRange,
  currentKLineResolution,
  onTouchScroll,
  onIndicatorsDialogOpenChange,
}: IUseTradingViewMessageHandlerParams) {
  const customReceiveHandler = useCallback(
    async ({ data }: ICustomReceiveHandlerData) => {
      // Debug: Log all incoming messages
      // console.log('🔍 TradingView message received:', {
      //   scope: data.scope,
      //   method: data.method,
      //   origin: data.origin,
      //   dataKeys: data.data ? Object.keys(data.data) : 'no data',
      // });

      // Create context for message handlers
      const context: IMessageHandlerContext = {
        tokenAddress,
        networkId,
        webRef,
        onPanesCountChange,
        accountAddress,
        tokenSymbol,
        marksTimeRange,
        currentKLineResolution,
      };

      // Handle TradingView private API requests
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getKLineData'
      ) {
        await handleKLineDataRequest({ data, context });
      }

      // Handle TradingView layout update messages
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_layoutUpdate'
      ) {
        await handleLayoutUpdate({ data, context });
      }

      // Handle TradingView analytics messages (interval, time frame, etc.)
      if (
        data.scope === '$private' &&
        data.method?.startsWith('tradingview_analytics_')
      ) {
        console.log('🔍 TradingView analytics message received:', data);

        await handleAnalyticsEvent(data.method, { data, context });
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getHyperliquidPriceScale'
      ) {
        await handleGetHyperliquidPriceScale({
          request: data.data as { symbol?: string; requestId?: string },
          webRef,
        });
      }

      if (data.scope === '$private' && data.method === 'tradingview_getMarks') {
        const marksRequest = data.data as {
          requestId?: string;
          from?: number;
          to?: number;
          symbol?: string;
          resolution?: string;
        };
        const resolution =
          marksRequest.resolution || currentKLineResolution?.current;

        await handleGetMarks({
          request: marksRequest,
          accountAddress,
          tokenAddress,
          networkId,
          resolution,
          webRef,
        });
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_touchScroll'
      ) {
        const touchData = data.data as ITradingViewTouchScrollData | undefined;
        const deltaY = Number(touchData?.deltaY ?? 0);
        if (Number.isFinite(deltaY) && deltaY !== 0) {
          onTouchScroll?.(deltaY);
        }
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_indicatorsDialog'
      ) {
        const dialogData = data.data as
          | ITradingViewIndicatorsDialogData
          | undefined;
        const isOpen = getIndicatorsDialogOpenState(dialogData);

        if (typeof isOpen === 'boolean') {
          onIndicatorsDialogOpenChange?.(isOpen);
        }
      }
    },
    [
      tokenAddress,
      networkId,
      webRef,
      onPanesCountChange,
      accountAddress,
      tokenSymbol,
      marksTimeRange,
      currentKLineResolution,
      onTouchScroll,
      onIndicatorsDialogOpenChange,
    ],
  );

  return {
    customReceiveHandler,
  };
}
