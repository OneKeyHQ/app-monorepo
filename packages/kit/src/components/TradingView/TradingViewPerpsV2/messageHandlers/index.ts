import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IFill, IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  IGetMarksRequest,
  IGetMarksResponse,
  ITradingMark,
} from '../types';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function usePerpsMessageHandler({
  symbol,
  userAddress,
  webRef,
}: {
  symbol: string;
  userAddress?: IHex | null;
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  const handleGetMarks = useCallback(
    async (request: IGetMarksRequest) => {
      const { requestId } = request;

      if (!userAddress) {
        webRef.current?.sendMessageViaInjectedScript({
          type: 'MARKS_RESPONSE',
          payload: {
            marks: [],
            requestId,
          },
        });
        return;
      }

      const historyTrades =
        await backgroundApiProxy.serviceHyperliquidInfo.getUserFillsByTime({
          user: userAddress,
          startTime: 1_731_024_000_000,
          endTime: 2_114_352_000_000,
          aggregateByTime: true,
        });

      console.log('historyTrades: =====>>>: ', historyTrades);

      // Filter trades by current symbol and format to TradingView marks
      const filteredTrades = historyTrades.filter(
        (trade: IFill) => trade.coin === symbol,
      );

      const marks: ITradingMark[] = filteredTrades.map(
        (trade: IFill, index: number) => {
          const isLong = trade.side === 'B'; // B = Buy, A = Sell (Ask)
          const isOpenPosition = trade.dir.includes('Open');

          // Determine label and color based on trade direction
          const getTradeLabel = () => {
            if (isOpenPosition) {
              return isLong ? 'B' : 'S'; // Buy Long or Sell Short
            }
            return isLong ? 'B' : 'S'; // Close position
          };

          // Color: Green for Buy (B), Red for Sell (S)
          const getTradeColor = () => {
            return isLong ? '#26a69a' : '#ef5350'; // Green for B, Red for S
          };

          // Generate descriptive text
          const getTradeText = () => {
            return `${trade.dir} at ${trade.px}`;
          };

          return {
            id: `trade_${trade.tid || index}`,
            time: trade.time / 1000, // Convert milliseconds to seconds
            color: getTradeColor(),
            text: getTradeText(),
            label: getTradeLabel(),
            labelFontColor: '#FFFFFF',
            size: 'normal' as const,
            shape: isLong ? ('arrowUp' as const) : ('arrowDown' as const),
          };
        },
      );

      const response: IGetMarksResponse = {
        marks,
        requestId,
      };

      webRef.current?.sendMessageViaInjectedScript({
        type: 'MARKS_RESPONSE',
        payload: response,
      });
    },
    [webRef, userAddress, symbol],
  );

  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      const { data } = payload;
      if (typeof data !== 'object' || data === null) return;
      if (
        (data as { scope?: string })?.scope === '$private' &&
        (data as { method?: string })?.method === 'tradingview_getMarks'
      ) {
        await handleGetMarks(
          (data as { data?: unknown }).data as IGetMarksRequest,
        );
      }
    },
    [handleGetMarks],
  );

  return { customReceiveHandler };
}
