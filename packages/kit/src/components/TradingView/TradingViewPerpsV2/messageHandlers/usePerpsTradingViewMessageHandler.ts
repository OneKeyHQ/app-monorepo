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
  onTouchScroll,
}: {
  symbol: string;
  userAddress?: IHex | null;
  webRef: React.RefObject<IWebViewRef | null>;
  onChartLinesReady?: (payload: ITVLineReadyPayload) => void;
  onOrderCancel?: (payload: ITVOrderCancelPayload) => void;
  onTouchScroll?: (deltaY: number) => void;
}) {
  const previousUserAddressRef = useRef<IHex | null | undefined>(userAddress);
  const marksRequestIdRef = useRef(0);
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();
  const [{ showTradeMarks }] = usePerpsCustomSettingsAtom();
  const actions = useHyperliquidActions();

  // Use refs to maintain stable references for callbacks
  const symbolRef = useRef(symbol);
  const userAddressRef = useRef(userAddress);

  // Update refs on every render
  symbolRef.current = symbol;
  userAddressRef.current = userAddress;

  const normalizeAddress = useCallback(
    (address: string | undefined | null) => address?.toLowerCase() || null,
    [],
  );

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
        .toSorted((a, b) => b.time - a.time);

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
    const currentUserAddress = normalizeAddress(userAddress);
    const currentSymbol = symbolRef.current;
    const requestId = marksRequestIdRef.current + 1;
    marksRequestIdRef.current = requestId;

    if (!currentUserAddress) {
      sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      return;
    }

    await fetchAndFormatMarks(
      currentSymbol,
      currentUserAddress as IHex,
      showTradeMarks ?? true,
    )
      .then((marks) => {
        const latestUserAddress = normalizeAddress(userAddressRef.current);
        const isStaleRequest =
          marksRequestIdRef.current !== requestId ||
          latestUserAddress !== currentUserAddress ||
          symbolRef.current !== currentSymbol;

        if (isStaleRequest) {
          return;
        }

        sendMarksUpdate(marks, EMarksUpdateOperationEnum.REPLACE);
      })
      .catch((error) => {
        console.error('Error fetching marks on user change:', error);

        if (marksRequestIdRef.current !== requestId) {
          return;
        }

        sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      });
  }, [
    fetchAndFormatMarks,
    normalizeAddress,
    sendMarksUpdate,
    showTradeMarks,
    userAddress,
  ]);

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
        const requestUserAddress = normalizeAddress(userAddressRef.current);
        const requestSymbol = symbolRef.current;
        const marks = await fetchAndFormatMarks(
          requestSymbol,
          requestUserAddress as IHex,
          showTradeMarks ?? true,
        );

        const latestUserAddress = normalizeAddress(userAddressRef.current);
        if (
          !requestUserAddress ||
          latestUserAddress !== requestUserAddress ||
          symbolRef.current !== requestSymbol
        ) {
          webRef.current?.sendMessageViaInjectedScript({
            type: 'MARKS_RESPONSE',
            payload: {
              marks: [],
              requestId,
            },
          });
          return;
        }

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
    [webRef, fetchAndFormatMarks, normalizeAddress, showTradeMarks],
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
        case 'tradingview_touchScroll': {
          const touchData = messageData.data as { deltaY?: number } | undefined;
          const deltaY = Number(touchData?.deltaY ?? 0);
          if (Number.isFinite(deltaY) && deltaY !== 0) {
            onTouchScroll?.(deltaY);
          }
          break;
        }
        default:
          break;
      }
    },
    [
      handleGetMarks,
      handleGetHyperliquidPriceScale,
      onChartLinesReady,
      onOrderCancel,
      onTouchScroll,
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
      marksRequestIdRef.current += 1;
      sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);

      if (!currentUserAddress) {
        // User logged out, clear marks
        console.log('[MarksHandler] User logged out, clear marks');
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
