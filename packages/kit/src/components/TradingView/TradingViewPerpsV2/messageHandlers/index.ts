import { useCallback, useEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAllMidsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { calculatePriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IFill,
  IHex,
  IWsUserFills,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

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
  const [allMids] = useAllMidsAtom();

  // Shared utility to convert fill data to TradingView mark
  const convertFillToMark = useCallback((fill: IFill): ITradingMark => {
    const isLong = fill.side === 'B'; // B = Buy, A = Sell (Ask)
    const isOpenPosition = fill.dir.includes('Open');

    const getTradeLabel = () => {
      if (isOpenPosition) {
        return isLong ? 'B' : 'S'; // Buy Long or Sell Short
      }
      return isLong ? 'B' : 'S'; // Close position
    };

    const getTradeText = () => {
      return `${fill.dir} at ${fill.px}`;
    };

    const getTradeColor = () => {
      if (isOpenPosition) {
        return isLong ? '#00C853' : '#FF1744'; // Green for long open, red for short open
      }
      return isLong ? '#4CAF50' : '#F44336'; // Lighter colors for close positions
    };

    return {
      id: `trade_${fill.tid || fill.oid}`,
      time: Math.floor(fill.time / 1000), // Convert milliseconds to seconds
      text: getTradeText(),
      label: getTradeLabel(),
      color: getTradeColor(),
    };
  }, []);

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

      const marks: ITradingMark[] = filteredTrades
        .map((trade: IFill) => convertFillToMark(trade))
        .sort((a, b) => b.time - a.time); // Sort by time descending (latest first)

      return marks;
    },
    [convertFillToMark],
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

      // Get price from allMids directly
      const midValue = allMids?.mids?.[requestSymbol];
      let calculatedPriceScale = 100; // default 2 decimal places

      if (midValue && Number(midValue) > 0) {
        // Use HyperLiquid precision rules to calculate price scale
        calculatedPriceScale = calculatePriceScale(midValue);
      }

      const response = {
        priceScale: calculatedPriceScale,
        minmov: 1,
        requestId,
      };

      console.log('[MessageHandler] Price scale response:', {
        symbol: requestSymbol,
        midValue,
        priceScale: calculatedPriceScale,
      });

      webRef.current?.sendMessageViaInjectedScript({
        type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
        payload: response,
      });
    },
    [webRef, allMids],
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
      if (!currentUserAddress) {
        // User logged out, clear marks
        console.log('[MarksHandler] User logged out, clear marks');
        sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      } else {
        // User changed or logged in, fetch fresh data
        void fetchAndFormatMarks(symbol, currentUserAddress)
          .then((marks) => {
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

  // Monitor real-time userFills updates
  useEffect(() => {
    if (!userAddress) return;

    const handleUserFillsUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'account';
        subType: string;
        data: IWsUserFills;
        metadata: {
          timestamp: number;
          source: string;
          userId?: string;
        };
      };

      // Only process USER_FILLS events
      if (eventPayload.subType !== ESubscriptionType.USER_FILLS) return;

      // Verify the data is for the current user
      if (eventPayload.metadata.userId !== userAddress) return;

      const { data } = eventPayload;

      // Skip snapshot data (only process incremental updates)
      if (data.isSnapshot) return;

      // Filter fills for the current symbol and convert to marks
      const relevantFills = data.fills.filter(
        (fill: IFill) => fill.coin === symbol,
      );

      if (relevantFills.length === 0) return;

      const newMarks = relevantFills.map((fill: IFill) =>
        convertFillToMark(fill),
      );

      // Send incremental update to TradingView
      console.log('[UserFillsHandler] Sending incremental marks update:', {
        symbol,
        userAddress,
        newMarks,
      });

      sendMarksUpdate(newMarks, EMarksUpdateOperationEnum.INCREMENTAL);
    };

    appEventBus.on(
      EAppEventBusNames.HyperliquidDataUpdate,
      handleUserFillsUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleUserFillsUpdate,
      );
    };
  }, [userAddress, symbol, sendMarksUpdate, convertFillToMark]);

  return {
    customReceiveHandler,
    sendMarksUpdate,
    fetchAndFormatMarks,
  };
}
