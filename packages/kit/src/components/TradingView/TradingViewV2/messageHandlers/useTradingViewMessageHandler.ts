import { useCallback } from 'react';

import { handleAnalyticsEvent } from './analyticsHandler';
import { handleKLineDataRequest } from './klineDataHandler';
import { handleLayoutUpdate } from './layoutUpdateHandler';

import type { IMarksTimeRange, IMessageHandlerContext } from './types';
import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../types';

interface IUseTradingViewMessageHandlerParams {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
  accountAddress?: string;
  tokenSymbol?: string;
  marksTimeRange?: React.MutableRefObject<IMarksTimeRange | null>;
  onTouchScroll?: (deltaY: number) => void;
}

export function useTradingViewMessageHandler({
  tokenAddress = '',
  networkId = '',
  webRef,
  onPanesCountChange,
  accountAddress,
  tokenSymbol,
  marksTimeRange,
  onTouchScroll,
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
        data.method === 'tradingview_touchScroll'
      ) {
        const touchData = data.data as { deltaY?: number } | undefined;
        const deltaY = Number(touchData?.deltaY ?? 0);
        if (Number.isFinite(deltaY) && deltaY !== 0) {
          onTouchScroll?.(deltaY);
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
      onTouchScroll,
    ],
  );

  return {
    customReceiveHandler,
  };
}
