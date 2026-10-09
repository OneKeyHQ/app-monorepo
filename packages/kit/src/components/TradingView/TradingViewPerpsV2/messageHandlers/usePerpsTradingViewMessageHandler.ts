import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import { noop } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsCustomSettingsAtom,
  usePerpsLayoutStateAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IFill,
  IHex,
  IWsUserFills,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  MESSAGE_TYPES,
  PERPS_TV_MESSAGE_METHODS,
} from '../constants/messageTypes';
import { EMarksUpdateOperationEnum } from '../types';
import {
  EPerpsChartAccountSwitchAction,
  createPerpsChartMarksLedger,
  getPerpsChartAccountSwitchAction,
  recordPerpsChartMarksSent,
  recordPerpsChartSymbol,
} from '../utils/perpsChartAccountSwitch';

import { getPerpsInteractionOverlayOpenState } from './interactionOverlayState';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  IGetMarksRequest,
  IGetMarksResponse,
  ITVChartOrderIntentPayload,
  ITVChartReadyPayload,
  ITVLineReadyPayload,
  ITVOrderCancelPayload,
  ITVOrderDraftCreatePayload,
  ITVOrderPriceUpdatePayload,
  ITradingMark,
} from '../types';

const DEFAULT_HYPERLIQUID_PRICE_SCALE = 100;

export function usePerpsTradingViewMessageHandler({
  symbol,
  userAddress,
  webRef,
  chartInstanceKey,
  hasAccountLinesRef,
  onAccountMarksRebuild,
  onChartReady,
  onChartLinesReady,
  onOrderCancel,
  onOrderDraftCreate,
  onOrderPriceUpdate,
  onChartOrderIntent,
  onTouchScroll,
  onInteractionOverlayOpenChange,
}: {
  symbol: string;
  userAddress?: IHex | null;
  webRef: React.RefObject<IWebViewRef | null>;
  chartInstanceKey: string;
  hasAccountLinesRef?: React.RefObject<boolean>;
  onAccountMarksRebuild: () => void;
  onChartReady?: (payload: ITVChartReadyPayload) => void;
  onChartLinesReady?: (payload: ITVLineReadyPayload) => void;
  onOrderCancel?: (payload: ITVOrderCancelPayload) => void;
  onOrderDraftCreate?: (payload: ITVOrderDraftCreatePayload) => void;
  onOrderPriceUpdate?: (payload: ITVOrderPriceUpdatePayload) => void;
  onChartOrderIntent?: (payload: ITVChartOrderIntentPayload) => void;
  onTouchScroll?: (deltaY: number) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}) {
  const previousUserAddressRef = useRef<IHex | null | undefined>(userAddress);
  const marksRequestIdRef = useRef(0);
  const accountGenerationRef = useRef(0);
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();
  const [{ showTradeMarks }] = usePerpsCustomSettingsAtom();
  const [, setLayoutState] = usePerpsLayoutStateAtom();

  // Use refs to maintain stable references for callbacks
  const symbolRef = useRef(symbol);
  const userAddressRef = useRef(userAddress);

  // Update refs on every render
  symbolRef.current = symbol;
  userAddressRef.current = userAddress;

  const marksLedgerRef = useRef(createPerpsChartMarksLedger());
  const marksLedgerInstanceKeyRef = useRef(chartInstanceKey);

  const normalizeAddress = useCallback(
    (address: string | undefined | null) => address?.toLowerCase() || null,
    [],
  );
  const normalizedUserAddress = normalizeAddress(userAddress);
  const marksAccountAddressRef = useRef(normalizedUserAddress);

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
      const marksSymbol = symbolRef.current;
      recordPerpsChartMarksSent(marksLedgerRef.current, {
        symbol: marksSymbol,
        marks,
        operation,
      });
      webRef.current?.sendMessageViaInjectedScript({
        type: MESSAGE_TYPES.MARKS_UPDATE,
        payload: {
          marks,
          symbol: marksSymbol,
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

  const refreshWebviewMarksByApiRef = useRef(refreshWebviewMarksByApi);
  refreshWebviewMarksByApiRef.current = refreshWebviewMarksByApi;

  // Handle legacy MARKS_RESPONSE for backward compatibility
  const handleGetMarks = useCallback(
    async (request: IGetMarksRequest) => {
      const { requestId } = request;
      // The chart caches the answer under the symbol it asked for, which can
      // lag behind the app symbol.
      const requestSymbol = request.symbol || symbolRef.current;
      const requestUserAddress = normalizeAddress(userAddressRef.current);
      const requestGeneration = accountGenerationRef.current;
      const requestLedger = marksLedgerRef.current;
      const isStaleRequest = () =>
        requestGeneration !== accountGenerationRef.current ||
        normalizeAddress(userAddressRef.current) !== requestUserAddress ||
        symbolRef.current !== requestSymbol;
      const respond = (marks: ITradingMark[]) => {
        if (requestLedger !== marksLedgerRef.current) return;
        recordPerpsChartMarksSent(requestLedger, {
          symbol: requestSymbol,
          marks,
        });
        const response: IGetMarksResponse = {
          marks,
          requestId,
        };
        webRef.current?.sendMessageViaInjectedScript({
          type: MESSAGE_TYPES.MARKS_RESPONSE,
          payload: response,
        });
      };

      if (!requestUserAddress) {
        respond([]);
        return;
      }

      try {
        const marks = await fetchAndFormatMarks(
          requestSymbol,
          requestUserAddress as IHex,
          showTradeMarks ?? true,
        );

        if (requestLedger !== marksLedgerRef.current) return;
        if (isStaleRequest()) {
          respond([]);
          // The chart caches any answer to a live request id and wipes the
          // drawn marks, so the current symbol has to be redrawn.
          void refreshWebviewMarksByApiRef.current();
          return;
        }

        respond(marks);
      } catch (error) {
        console.error('Error fetching marks:', error);
        if (requestLedger !== marksLedgerRef.current) return;
        respond([]);
        if (isStaleRequest()) {
          void refreshWebviewMarksByApiRef.current();
        }
      }
    },
    [webRef, fetchAndFormatMarks, normalizeAddress, showTradeMarks],
  );

  // Handle HyperLiquid price scale requests
  const handleGetHyperliquidPriceScale = useCallback(
    async (request: { symbol: string; requestId: string }) => {
      const { symbol: requestSymbol, requestId } = request;
      let priceScale: number | undefined;

      // Single background call: cache/persisted answers return immediately so
      // the chart's resolveSymbol never waits on the REST allMids fallback.
      try {
        ({ priceScale } =
          await backgroundApiProxy.serviceHyperliquid.getTradingviewPriceScale({
            symbol: requestSymbol,
          }));
      } catch (error) {
        console.error('[MessageHandler] Failed to load price scale:', error);
      }

      webRef.current?.sendMessageViaInjectedScript({
        type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
        payload: {
          priceScale: priceScale ?? DEFAULT_HYPERLIQUID_PRICE_SCALE,
          minmov: 1,
          requestId,
        },
      });
    },
    [webRef],
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
        case 'tradingview_getMarks': {
          const request = messageData.data as IGetMarksRequest;
          recordPerpsChartSymbol(marksLedgerRef.current, request.symbol);
          await handleGetMarks(request);
          break;
        }
        case 'tradingview_getHyperliquidPriceScale':
          await handleGetHyperliquidPriceScale(
            messageData.data as { symbol: string; requestId: string },
          );
          break;
        case PERPS_TV_MESSAGE_METHODS.CHART_READY: {
          const chartReadyPayload = messageData.data as ITVChartReadyPayload;
          recordPerpsChartSymbol(
            marksLedgerRef.current,
            chartReadyPayload?.symbol,
          );
          onChartReady?.(chartReadyPayload);
          break;
        }
        case PERPS_TV_MESSAGE_METHODS.READY:
          // Chart lines iframe is ready to receive data
          onChartLinesReady?.(messageData.data as ITVLineReadyPayload);
          break;
        case 'tradingview_perpsOrderCancel':
          // User clicked cancel button on order line in TradingView chart
          onOrderCancel?.(messageData.data as ITVOrderCancelPayload);
          break;
        case PERPS_TV_MESSAGE_METHODS.ORDER_DRAFT_CREATE:
          onOrderDraftCreate?.(messageData.data as ITVOrderDraftCreatePayload);
          break;
        case PERPS_TV_MESSAGE_METHODS.CHART_ORDER_INTENT:
          onChartOrderIntent?.(messageData.data as ITVChartOrderIntentPayload);
          break;
        case PERPS_TV_MESSAGE_METHODS.ORDER_PRICE_UPDATE:
          onOrderPriceUpdate?.(messageData.data as ITVOrderPriceUpdatePayload);
          break;
        case PERPS_TV_MESSAGE_METHODS.CHART_EXPAND: {
          const expandData = messageData.data as
            | { expanded?: boolean }
            | undefined;
          setLayoutState((prev) => ({
            ...prev,
            chartExpanded: expandData?.expanded ?? false,
          }));
          break;
        }
        case 'tradingview_touchScroll': {
          const touchData = messageData.data as { deltaY?: number } | undefined;
          const deltaY = Number(touchData?.deltaY ?? 0);
          if (Number.isFinite(deltaY) && deltaY !== 0) {
            onTouchScroll?.(deltaY);
          }
          break;
        }
        case 'tradingview_interactionOverlay': {
          const isOpen = getPerpsInteractionOverlayOpenState(messageData.data);
          if (typeof isOpen === 'boolean') {
            onInteractionOverlayOpenChange?.(isOpen);
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
      onChartReady,
      onChartLinesReady,
      onOrderCancel,
      onOrderDraftCreate,
      onOrderPriceUpdate,
      onChartOrderIntent,
      onTouchScroll,
      onInteractionOverlayOpenChange,
      setLayoutState,
    ],
  );

  const previousSymbolRef = useRef(symbol);
  useLayoutEffect(() => {
    // A re-keyed WebView loads a chart page with empty marks caches.
    if (marksLedgerInstanceKeyRef.current !== chartInstanceKey) {
      marksLedgerInstanceKeyRef.current = chartInstanceKey;
      marksLedgerRef.current = createPerpsChartMarksLedger();
      previousSymbolRef.current = symbol;
    }
  }, [chartInstanceKey, symbol]);

  useLayoutEffect(() => {
    if (previousSymbolRef.current !== symbol) {
      previousSymbolRef.current = symbol;
      marksLedgerRef.current.chartSymbol = undefined;
      marksLedgerRef.current.symbolChanged = true;
    }
  }, [symbol]);

  // Rebuild before paint if legacy messages cannot safely isolate the account.
  useLayoutEffect(() => {
    if (marksAccountAddressRef.current === normalizedUserAddress) {
      return;
    }
    marksAccountAddressRef.current = normalizedUserAddress;
    accountGenerationRef.current += 1;
    marksRequestIdRef.current += 1;

    const ledger = marksLedgerRef.current;
    const currentSymbol = symbolRef.current;
    const action = getPerpsChartAccountSwitchAction({
      hasAccountLines: hasAccountLinesRef?.current,
      markedSymbols: ledger.markedSymbols,
      chartSymbol: ledger.chartSymbol,
      symbol: currentSymbol,
    });
    if (action === EPerpsChartAccountSwitchAction.KeepChart) {
      return;
    }
    if (
      action === EPerpsChartAccountSwitchAction.ClearSymbolMarks &&
      webRef.current
    ) {
      sendMarksUpdate([], EMarksUpdateOperationEnum.CLEAR);
      ledger.markedSymbols.delete(currentSymbol);
      return;
    }
    onAccountMarksRebuild();
  }, [
    normalizedUserAddress,
    onAccountMarksRebuild,
    sendMarksUpdate,
    hasAccountLinesRef,
    webRef,
  ]);

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
