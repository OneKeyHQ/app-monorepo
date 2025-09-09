import { useCallback, useEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrentTokenPriceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { calculatePriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFill, IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { MESSAGE_TYPES } from '../constants/messageTypes';
import { EMarksUpdateOperationEnum } from '../types';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  IGetMarksRequest,
  IGetMarksResponse,
  ITradingMark,
} from '../types';

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
  const [priceData] = useCurrentTokenPriceAtom();

  useEffect(() => {
    if (priceData) {
      // console.log('[MarksHandler] priceData: ', priceData);
    }
  }, [priceData]);

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

  // Handle HyperLiquid price scale requests
  const handleGetHyperliquidPriceScale = useCallback(
    async (request: { symbol: string; requestId: string }) => {
      const { symbol: requestSymbol, requestId } = request;

      console.log('[MessageHandler] handleGetHyperliquidPriceScale: ', request);

      // Wait for matching symbol and valid market price with 3s timeout
      const startTime = Date.now();
      const timeout = 3000; // 3 seconds
      let currentPriceData = priceData;

      while (Date.now() - startTime < timeout) {
        // Check if we have matching symbol and valid price
        if (
          currentPriceData?.coin === requestSymbol &&
          currentPriceData?.markPrice &&
          Number(currentPriceData.markPrice) > 0
        ) {
          break;
        }

        console.log(
          '[MessageHandler] Waiting for matching symbol and valid price...',
          {
            requested: requestSymbol,
            currentSymbol: currentPriceData?.coin,
            currentPrice: currentPriceData?.markPrice,
            elapsed: Date.now() - startTime,
          },
        );

        await timerUtils.wait(100);
        currentPriceData = priceData;
      }

      // Calculate priceScale using HyperLiquid precision rules
      let calculatedPriceScale = 100; // default 2 decimal places

      if (
        currentPriceData?.coin === requestSymbol &&
        currentPriceData?.markPrice &&
        Number(currentPriceData.markPrice) > 0
      ) {
        // Use simplified HyperLiquid precision rules to calculate price scale
        calculatedPriceScale = calculatePriceScale(currentPriceData.markPrice);
      }

      const response = {
        priceScale: calculatedPriceScale,
        minmov: 1,
        requestId,
      };

      console.log('[MessageHandler] Price scale response:', {
        symbol: requestSymbol,
        matchedSymbol: currentPriceData?.coin,
        markPrice: currentPriceData?.markPrice,
        priceScale: calculatedPriceScale,
        timeout: Date.now() - startTime >= timeout,
      });

      webRef.current?.sendMessageViaInjectedScript({
        type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
        payload: response,
      });
    },
    [webRef, priceData],
  );

  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      const { data } = payload;
      if (typeof data !== 'object' || data === null) return;

      const messageData = data as {
        scope?: string;
        method?: string;
        data?: unknown;
      };

      if (messageData.scope !== IInjectedProviderNames.$private) return;

      switch (messageData.method) {
        case 'tradingview_getMarks':
          await handleGetMarks(messageData.data as IGetMarksRequest);
          break;
        case 'tradingview_getHyperliquidPriceScale':
          await handleGetHyperliquidPriceScale(
            messageData.data as { symbol: string; requestId: string },
          );
          break;
        default:
          break;
      }
    },
    [handleGetMarks, handleGetHyperliquidPriceScale],
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
