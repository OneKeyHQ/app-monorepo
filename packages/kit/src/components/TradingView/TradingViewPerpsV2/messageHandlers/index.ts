import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IFill, IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { MESSAGE_TYPES } from '../constants/messageTypes';
import { EMarksUpdateOperationEnum } from '../types';

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
  const previousUserAddressRef = useRef<IHex | null | undefined>(userAddress);

  // Extract shared logic for fetching and formatting marks
  const fetchAndFormatMarks = useCallback(
    async (
      targetSymbol: string,
      targetUserAddress: IHex,
    ): Promise<ITradingMark[]> => {
      const historyTrades =
        await backgroundApiProxy.serviceHyperliquidInfo.getUserFillsByTime({
          user: targetUserAddress,
          startTime: 1_731_024_000_000,
          endTime: 2_114_352_000_000,
          aggregateByTime: true,
        });

      // Filter trades by target symbol and format to TradingView marks
      const filteredTrades = historyTrades.filter(
        (trade: IFill) => trade.coin === targetSymbol,
      );

      // @ts-expect-error
      const marks: ITradingMark[] = filteredTrades
        .map((trade: IFill, index: number) => {
          const isLong = trade.side === 'B'; // B = Buy, A = Sell (Ask)
          const isOpenPosition = trade.dir.includes('Open');

          // Determine label and color based on trade direction
          const getTradeLabel = () => {
            if (isOpenPosition) {
              return isLong ? 'B' : 'S'; // Buy Long or Sell Short
            }
            return isLong ? 'B' : 'S'; // Close position
          };

          // Generate descriptive text
          const getTradeText = () => {
            return `${trade.dir} at ${trade.px}`;
          };

          return {
            id: `trade_${trade.tid || index}`,
            time: Math.floor(trade.time / 1000), // Convert milliseconds to seconds
            text: getTradeText(),
            label: getTradeLabel(),
            raw: trade,
          };
        })
        .sort((a, b) => b.time - a.time); // Sort by time ascending (earliest first)

      return marks;
    },
    [],
  );

  // Function to send marks update to iframe
  const sendMarksUpdate = useCallback(
    (marks: ITradingMark[], operation: EMarksUpdateOperationEnum) => {
      webRef.current?.sendMessageViaInjectedScript({
        type: MESSAGE_TYPES.MARKS_UPDATE,
        payload: {
          marks,
          symbol,
          operation,
        },
      });
    },
    [webRef, symbol],
  );

  // Handle legacy MARKS_RESPONSE for backward compatibility
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

      try {
        const marks = await fetchAndFormatMarks(symbol, userAddress);
        console.log('[MarksHandler] fetch marks: ', marks);

        const response: IGetMarksResponse = {
          marks,
          requestId,
        };

        webRef.current?.sendMessageViaInjectedScript({
          type: 'MARKS_RESPONSE',
          payload: response,
        });
      } catch (error) {
        console.error('Error fetching marks:', error);
        webRef.current?.sendMessageViaInjectedScript({
          type: 'MARKS_RESPONSE',
          payload: {
            marks: [],
            requestId,
          },
        });
      }
    },
    [webRef, userAddress, symbol, fetchAndFormatMarks],
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

  // Monitor userAddress changes and push updates
  useEffect(() => {
    const previousUserAddress = previousUserAddressRef.current;
    const currentUserAddress = userAddress;

    // Skip on initial mount
    if (previousUserAddress === undefined) {
      previousUserAddressRef.current = currentUserAddress;
      return;
    }

    // User address changed
    if (previousUserAddress !== currentUserAddress) {
      console.log('[MarksHandler] UserAddress changed:', {
        from: previousUserAddress,
        to: currentUserAddress,
        symbol,
      });

      if (!currentUserAddress) {
        // User logged out, clear marks
        console.log('[MarksHandler] User logged out, clear marks');
        sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      } else {
        // User changed or logged in, fetch fresh data
        void fetchAndFormatMarks(symbol, currentUserAddress)
          .then((marks) => {
            console.log(
              '[MarksHandler] User logged in, fetch fresh data: ',
              marks,
            );
            sendMarksUpdate(marks, EMarksUpdateOperationEnum.REPLACE);
          })
          .catch((error) => {
            console.error('Error fetching marks on user change:', error);
            sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
          });
      }

      previousUserAddressRef.current = currentUserAddress;
    }
  }, [userAddress, symbol, fetchAndFormatMarks, sendMarksUpdate]);

  return {
    customReceiveHandler,
    sendMarksUpdate,
    fetchAndFormatMarks,
  };
}
