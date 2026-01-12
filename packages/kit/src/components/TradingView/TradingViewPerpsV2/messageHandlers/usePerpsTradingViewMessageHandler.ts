import { useCallback, useEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import { noop } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsCustomSettingsAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { calculateDisplayPriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IFill,
  IHex,
  IWsUserFills,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { MESSAGE_TYPES } from '../constants/messageTypes';
import { EMarksUpdateOperationEnum } from '../types';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  IGetMarksRequest,
  IGetMarksResponse,
  ITVLineReadyPayload,
  ITVOrderCancelPayload,
  ITradingMark,
} from '../types';

export function usePerpsTradingViewMessageHandler({
  symbol,
  userAddress,
  webRef,
  onChartLinesReady,
  onOrderCancel,
}: {
  symbol: string;
  userAddress?: IHex | null;
  webRef: React.RefObject<IWebViewRef | null>;
  onChartLinesReady?: (payload: ITVLineReadyPayload) => void;
  onOrderCancel?: (payload: ITVOrderCancelPayload) => void;
}) {
  const previousUserAddressRef = useRef<IHex | null | undefined>(userAddress);
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();
  const [{ showTradeMarks }] = usePerpsCustomSettingsAtom();
  const actions = useHyperliquidActions();

  // Use refs to maintain stable references for callbacks
  const symbolRef = useRef(symbol);
  const userAddressRef = useRef(userAddress);

  // Update refs on every render
  symbolRef.current = symbol;
  userAddressRef.current = userAddress;

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
      shouldShowMarks: boolean,
    ): Promise<ITradingMark[]> => {
      // Return empty array if marks display is disabled
      if (!shouldShowMarks) {
        return [];
      }

      const historyTrades: IFill[] =
        await backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
          targetUserAddress,
        );

      const filteredTrades = historyTrades.filter(
        (trade) => trade.coin === targetSymbol,
      );

      const marks: ITradingMark[] = filteredTrades
        .map((trade) => convertFillToMark(trade))
        .sort((a, b) => b.time - a.time);

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
          symbol: symbolRef.current,
          operation,
        },
      });
    },
    [webRef],
  );

  const refreshWebviewMarksByApi = useCallback(async () => {
    const currentUserAddress = userAddress;
    if (!currentUserAddress) {
      return;
    }
    await fetchAndFormatMarks(
      symbolRef.current,
      currentUserAddress,
      showTradeMarks ?? true,
    )
      .then((marks) => {
        sendMarksUpdate(marks, EMarksUpdateOperationEnum.REPLACE);
      })
      .catch((error) => {
        console.error('Error fetching marks on user change:', error);
        sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      });
  }, [fetchAndFormatMarks, sendMarksUpdate, userAddress, showTradeMarks]);

  // Handle legacy MARKS_RESPONSE for backward compatibility
  const handleGetMarks = useCallback(
    async (request: IGetMarksRequest) => {
      const { requestId } = request;

      if (!userAddressRef.current) {
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
        const marks = await fetchAndFormatMarks(
          symbolRef.current,
          userAddressRef.current,
          showTradeMarks ?? true,
        );

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
    [webRef, fetchAndFormatMarks, showTradeMarks],
  );

  // Handle HyperLiquid price scale requests
  const handleGetHyperliquidPriceScale = useCallback(
    async (request: { symbol: string; requestId: string }) => {
      const { symbol: requestSymbol, requestId } = request;

      const getValidMidValue = async () => {
        return (
          await actions.current.getMidPrice({
            coin: requestSymbol,
          })
        ).mid;
      };

      const WAIT_TIMEOUT_MS = timerUtils.getTimeDurationMs({ seconds: 3 });
      const WAIT_INTERVAL_MS = 200;

      let midValue = await getValidMidValue();
      let calculatedPriceScale = 100; // default 2 decimal places
      let persistedPriceScale: number | undefined;
      let priceScaleSource: 'calculated' | 'persisted' | 'default' = 'default';

      if (!midValue) {
        try {
          persistedPriceScale =
            await backgroundApiProxy.serviceHyperliquid.getTradingviewDisplayPriceScale(
              requestSymbol,
            );
        } catch (error) {
          console.error(
            '[MessageHandler] Failed to load stored price scale:',
            error,
          );
        }
      }

      if (!midValue && persistedPriceScale === undefined) {
        const deadline = Date.now() + WAIT_TIMEOUT_MS;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
          midValue = await getValidMidValue();
          if (midValue) {
            break;
          }
        }
      }

      if (midValue) {
        calculatedPriceScale = calculateDisplayPriceScale(midValue);
        priceScaleSource = 'calculated';
        try {
          await backgroundApiProxy.serviceHyperliquid.setTradingviewDisplayPriceScale(
            {
              symbol: requestSymbol,
              priceScale: calculatedPriceScale,
            },
          );
        } catch (error) {
          console.error(
            '[MessageHandler] Failed to persist price scale:',
            error,
          );
        }
      } else if (persistedPriceScale !== undefined) {
        calculatedPriceScale = persistedPriceScale;
        priceScaleSource = 'persisted';
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
        priceScaleSource,
      });

      webRef.current?.sendMessageViaInjectedScript({
        type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
        payload: response,
      });
    },
    [actions, webRef],
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
        case 'tradingview_perpsReady':
          // Chart lines iframe is ready to receive data
          onChartLinesReady?.(messageData.data as ITVLineReadyPayload);
          break;
        case 'tradingview_perpsOrderCancel':
          // User clicked cancel button on order line in TradingView chart
          onOrderCancel?.(messageData.data as ITVOrderCancelPayload);
          break;
        default:
          break;
      }
    },
    [
      handleGetMarks,
      handleGetHyperliquidPriceScale,
      onChartLinesReady,
      onOrderCancel,
    ],
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
        void refreshWebviewMarksByApi();
      }

      previousUserAddressRef.current = currentUserAddress;
    }
  }, [userAddress, refreshWebviewMarksByApi, sendMarksUpdate]);

  useEffect(() => {
    noop(refreshHook);
    void refreshWebviewMarksByApi();
  }, [refreshHook, refreshWebviewMarksByApi]);

  // Monitor real-time userFills updates
  useEffect(() => {
    // Skip if marks display is disabled or no user address
    if (!userAddress || showTradeMarks === false) return;

    const handleUserFillsUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: EPerpsSubscriptionCategory;
        subType: ESubscriptionType;
        data: IWsUserFills;
      };

      if (eventPayload.type !== EPerpsSubscriptionCategory.ACCOUNT) return;

      // Only process USER_FILLS events
      if (eventPayload.subType !== ESubscriptionType.USER_FILLS) return;

      // Verify the data is for the current user
      if (
        !eventPayload?.data?.user ||
        eventPayload?.data?.user?.toLowerCase() !==
          userAddressRef.current?.toLowerCase()
      ) {
        return;
      }

      const { data } = eventPayload;

      // Skip snapshot data (only process incremental updates)
      if (data.isSnapshot) return;

      // Filter fills for the current symbol and convert to marks
      const relevantFills = data.fills.filter(
        (fill: IFill) => fill.coin === symbolRef.current,
      );

      if (relevantFills.length === 0) return;

      const newMarks = relevantFills.map((fill: IFill) =>
        convertFillToMark(fill),
      );

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
  }, [userAddress, sendMarksUpdate, convertFillToMark, showTradeMarks]);

  return {
    customReceiveHandler,
    sendMarksUpdate,
    fetchAndFormatMarks,
  };
}
