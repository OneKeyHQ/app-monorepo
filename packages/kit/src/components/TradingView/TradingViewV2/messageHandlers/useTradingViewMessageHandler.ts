import { useCallback } from 'react';

import { handleKLineDataRequest } from './klineDataHandler';
import { handleLayoutUpdate } from './layoutUpdateHandler';

import type { IMessageHandlerContext } from './types';
import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../types';

interface IUseTradingViewMessageHandlerParams {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
}

export function useTradingViewMessageHandler({
  tokenAddress = '',
  networkId = '',
  webRef,
  onPanesCountChange,
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
    },
    [tokenAddress, networkId, webRef, onPanesCountChange],
  );

  return {
    customReceiveHandler,
  };
}
