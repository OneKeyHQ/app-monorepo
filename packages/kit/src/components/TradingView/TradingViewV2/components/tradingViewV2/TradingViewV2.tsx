import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SizableText, Stack, useTheme } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import type { ITradingViewDisabledFeature } from '@onekeyhq/kit/src/components/TradingView/constants';
import {
  syncTradingViewTheme,
  useNavigationHandler,
  useTradingViewUrl,
} from '@onekeyhq/kit/src/components/TradingView/hooks';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { ITradingViewKLineMockEmptyInterval } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { calculateDisplayPriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import {
  type ICalendarPanelSubmitPayload,
  type ITradingViewNativeChartTypeControlMode,
  type ITradingViewNativeControlsLayoutMode,
  type ITradingViewNativeIndicatorControlMode,
  type ITradingViewNativeIntervalControlMode,
  type ITradingViewNativePriceMarketCapControlMode,
  TradingViewNativeIndicatorQuickBar,
  TradingViewV2ChartControlsContainer,
  getTradingViewNativeSubIndicatorCountForSnapshot,
  useNativeIndicatorActiveValues,
} from '../TradingViewV2ChartControls';

import {
  buildMarketTradingViewIdentityKey,
  buildMarketTradingViewUrl,
  prefetchTradingViewV2FirstScreenData,
  resolveMarketTradingViewStorageNamespace,
  subscribeTradingViewV2FirstScreenPrefetch,
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useHyperLiquidKlineSource,
  useMarketSymbolSync,
  useMarketTradingViewFrameIdentity,
  useTradingViewV2WebSocket,
} from './hooks';
import {
  DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  fetchAndSendAccountMarks,
  normalizeTradingViewKLineInterval,
  useTradingViewMessageHandler,
} from './messageHandlers';
import { captureTradingViewRequestTarget } from './messageHandlers/tradingViewRequestTarget';
import { resolveTradingViewNativeIndicatorQuickBarState } from './nativeIndicatorQuickBarState';
import { TRADING_VIEW_NATIVE_MINIMAL_BRIDGE_SCRIPT } from './nativeTradingViewBridge';
import { TradingViewRuntimeView } from './TradingViewRuntimeView';
import { resolveTradingViewStorageNamespace } from './tradingViewStorageNamespace';

import type { ITradingViewV2KLineDataFallback } from './hooks/useTradingViewV2';
import type { IMarksTimeRange } from './messageHandlers';
import type { ITradingViewNativeIndicatorQuickBarState } from './nativeIndicatorQuickBarState';
import type {
  ICustomReceiveHandlerData,
  ITradingViewChartReadyData,
  ITradingViewFirstPaintReadyData,
  ITradingViewHistoryReadyData,
  ITradingViewIntervalConfigData,
  ITradingViewKLineDataReadyData,
  ITradingViewKLineLoadErrorData,
  ITradingViewKLinePeriodChangeData,
  ITradingViewLegacyHistoryReadyData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
  ITradingViewPriceScaleMode,
  ITradingViewPriceUpdateData,
} from '../../types';
import type { WebViewProps } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';

const MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES = [
  { right: '$2', bottom: '$2' },
  { left: '$2', bottom: '$2' },
  { left: '$2', top: '$2' },
  { right: '$2', top: '$2' },
] as const;
const TRADINGVIEW_INTERVAL_CHANGE_MESSAGE = 'TRADINGVIEW_INTERVAL_CHANGE';
const TRADINGVIEW_INDICATOR_SELECT_MESSAGE = 'TRADINGVIEW_INDICATOR_SELECT';
const TRADINGVIEW_CHART_TYPE_CHANGE_MESSAGE = 'TRADINGVIEW_CHART_TYPE_CHANGE';
const TRADINGVIEW_RESET_LAYOUT_MESSAGE = 'TRADINGVIEW_RESET_LAYOUT';
const TRADINGVIEW_PRICE_SCALE_CHANGE_MESSAGE = 'TRADINGVIEW_PRICE_SCALE_CHANGE';
const TRADINGVIEW_PRICE_MARKET_CAP_CHANGE_MESSAGE =
  'TRADINGVIEW_PRICE_MARKET_CAP_CHANGE';
const TRADINGVIEW_OPEN_CHART_SETTINGS_MESSAGE =
  'TRADINGVIEW_OPEN_CHART_SETTINGS';
const TRADINGVIEW_CLOSE_POPUPS_AND_DIALOGS_MESSAGE =
  'TRADINGVIEW_CLOSE_POPUPS_AND_DIALOGS';
const TRADINGVIEW_CALENDAR_PANEL_SUBMIT_MESSAGE =
  'TRADINGVIEW_CALENDAR_PANEL_SUBMIT';
const TRADINGVIEW_UNDO_MESSAGE = 'TRADINGVIEW_UNDO';
const TRADINGVIEW_REDO_MESSAGE = 'TRADINGVIEW_REDO';
const KLINE_BOOTSTRAP_PROTOCOL_VERSION = 1;

function formatMockEmptyKLineIntervals(
  intervals: ITradingViewKLineMockEmptyInterval[] | undefined,
) {
  if (!intervals?.length) {
    return '未选择周期';
  }
  return intervals.join('/');
}

interface IBaseTradingViewV2Props {
  symbol: string;
  tokenAddress?: string;
  networkId?: string;
  decimal: number;
  marketPrice?: string | number;
  historyStartTime?: number;
  initialKLineResolution?: string;
  initialHyperLiquidKLineResolution?: string;
  enabled?: boolean;
  isVisibilityManagedExternally?: boolean;
  onPanesCountChange?: (count: number) => void;
  dataSource?: 'websocket' | 'polling';
  accountAddress?: string;
  onTouchScroll?: (deltaY: number) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
  disabledFeatures?: readonly ITradingViewDisabledFeature[];
  storageNamespace?: string;
  forceEmptyKLineData?: boolean;
  emptyKLineDataOnError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
  onPriceUpdate?: (data: ITradingViewPriceUpdateData) => void;
  enableNativeChartControls?: boolean;
  enableNativeChartSettings?: boolean;
  enableNativeIntervalSelector?: boolean;
  /** Limits new selections without hiding sub-indicators that are already active. */
  maxSelectableSubIndicatorCount?: number;
  // `null` means the WebView controls configuration is not ready.
  onNativeSubIndicatorCountChange?: (
    count: number | null,
    options?: { layoutRestored?: boolean },
  ) => void;
  nativeChartTypeControlMode?: ITradingViewNativeChartTypeControlMode;
  nativeIndicatorControlMode?: ITradingViewNativeIndicatorControlMode;
  nativeIntervalControlMode?: ITradingViewNativeIntervalControlMode;
  nativePriceMarketCapControlMode?: ITradingViewNativePriceMarketCapControlMode;
  nativeControlsLayoutMode?: ITradingViewNativeControlsLayoutMode;
  isNativeChartFullscreen?: boolean;
  nativeChartFullscreenHeader?: ReactNode;
  showNativeIndicatorQuickBar?: boolean;
  onChartSwitch?: () => void;
  onNativeIndicatorQuickBarChange?: (
    state: ITradingViewNativeIndicatorQuickBarState,
  ) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onKLineDataReady?: (data: ITradingViewKLineDataReadyData) => void;
  onKLineLoadError?: (data: ITradingViewKLineLoadErrorData) => void;
  onKLinePeriodChange?: (data: ITradingViewKLinePeriodChangeData) => void;
  forceCandlestickChart?: boolean;
  onLegacyHistoryReady?: (data: ITradingViewLegacyHistoryReadyData) => void;
  onFirstPaintReady?: (data: ITradingViewFirstPaintReadyData) => void;
  onChartError?: () => void;
  onChartReady?: () => void;
  onVisualReady?: () => void;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const webRef = useRef<IWebViewRef | null>(null);
  const webViewLoadGeneration = useRef(0);
  const cancelInitialHistoryBootstrapSubscriptionRef = useRef<
    (() => void) | undefined
  >(undefined);
  const deliverInitialHistoryBootstrapRef = useRef<
    ((ref: IWebViewRef) => void) | undefined
  >(undefined);
  const marksTimeRange = useRef<IMarksTimeRange | null>(null);
  const currentKLineResolution = useRef(DEFAULT_TRADING_VIEW_KLINE_RESOLUTION);
  const [activeKLineResolution, setActiveKLineResolution] = useState(
    DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  );
  const [intervalConfig, setIntervalConfig] =
    useState<ITradingViewIntervalConfigData | null>(null);
  const [nativeChartControlsConfig, setNativeChartControlsConfig] =
    useState<ITradingViewNativeChartControlsConfigData | null>(null);
  const [isMarketSymbolSyncSupported, setIsMarketSymbolSyncSupported] =
    useState<boolean>();
  const [
    isMarketSymbolSyncStudiesSupported,
    setIsMarketSymbolSyncStudiesSupported,
  ] = useState<boolean>();
  const [
    isMarketAppKlineTransportSupported,
    setIsMarketAppKlineTransportSupported,
  ] = useState<boolean>();
  const [isHistoryReadyAckSupported, setIsHistoryReadyAckSupported] =
    useState<boolean>();
  const [isKLineHistoryReady, setIsKLineHistoryReady] = useState(false);
  const nativeIndicatorState = useNativeIndicatorActiveValues(
    nativeChartControlsConfig?.indicators,
  );
  const theme = useThemeVariant();
  const latestThemeRef = useRef(theme);
  latestThemeRef.current = theme;
  const themeColors = useTheme();
  const tradingViewBackgroundColor = themeColors.bgApp.val;
  const isRouteVisible = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [
    mockEmptyKLineBadgePositionIndex,
    setMockEmptyKLineBadgePositionIndex,
  ] = useState(0);

  const {
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    marketPrice,
    historyStartTime,
    initialKLineResolution,
    initialHyperLiquidKLineResolution,
    enabled = true,
    isVisibilityManagedExternally = false,
    onPanesCountChange,
    dataSource,
    accountAddress,
    onTouchScroll,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    disabledFeatures,
    storageNamespace,
    forceEmptyKLineData,
    emptyKLineDataOnError,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    onPrimaryKLineDataUnavailable,
    onPriceUpdate,
    enableNativeChartControls: enableNativeChartControlsProp,
    enableNativeChartSettings = false,
    enableNativeIntervalSelector: enableNativeIntervalSelectorProp = false,
    maxSelectableSubIndicatorCount,
    onNativeSubIndicatorCountChange,
    nativeChartTypeControlMode,
    nativeIndicatorControlMode,
    nativeIntervalControlMode,
    nativePriceMarketCapControlMode,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
    showNativeIndicatorQuickBar = true,
    onChartSwitch,
    onNativeIndicatorQuickBarChange,
    onNativeChartFullscreenChange,
    onKLineDataReady,
    onKLineLoadError,
    onKLinePeriodChange,
    forceCandlestickChart = false,
    onLegacyHistoryReady,
    onFirstPaintReady,
    onChartError,
    onChartReady,
    onVisualReady,
    onContentProcessDidTerminate,
    onLoadEnd,
    onLoadStart,
    ...stackStyle
  } = props;
  const isVisible =
    enabled && (isVisibilityManagedExternally || isRouteVisible);
  const isDataRequestEnabledRef = useRef(isVisible);
  isDataRequestEnabledRef.current = isVisible;
  const enableNativeChartControls = Boolean(enableNativeChartControlsProp);
  const enableNativeIntervalSelector =
    enableNativeIntervalSelectorProp || enableNativeChartControls;
  const hasNativeChartControlsConfig = Boolean(nativeChartControlsConfig);
  const isNativeChartControlsReady =
    !enableNativeChartControls || hasNativeChartControlsConfig;
  const nativeSubIndicatorCount = useMemo(
    () =>
      getTradingViewNativeSubIndicatorCountForSnapshot({
        activeIndicatorValues: nativeIndicatorState.activeIndicatorValues,
        configIndicators: nativeChartControlsConfig?.indicators,
        isInitialized: nativeIndicatorState.isInitialized,
        sourceIndicators: nativeIndicatorState.sourceIndicators,
      }),
    [
      nativeChartControlsConfig?.indicators,
      nativeIndicatorState.activeIndicatorValues,
      nativeIndicatorState.isInitialized,
      nativeIndicatorState.sourceIndicators,
    ],
  );

  useEffect(() => {
    if (!enableNativeChartControls) {
      return;
    }
    onNativeSubIndicatorCountChange?.(
      hasNativeChartControlsConfig ? nativeSubIndicatorCount : null,
      hasNativeChartControlsConfig
        ? { layoutRestored: nativeChartControlsConfig?.layoutRestored }
        : undefined,
    );
  }, [
    enableNativeChartControls,
    hasNativeChartControlsConfig,
    nativeChartControlsConfig?.layoutRestored,
    nativeSubIndicatorCount,
    onNativeSubIndicatorCountChange,
  ]);

  const handleCurrentKLineResolutionChange = useCallback(
    (resolution: string) => {
      const normalizedResolution =
        normalizeTradingViewKLineInterval(resolution);
      currentKLineResolution.current = normalizedResolution;
      setActiveKLineResolution((prev) =>
        prev === normalizedResolution ? prev : normalizedResolution,
      );
    },
    [],
  );
  const handleIntervalConfigChange = useCallback(
    (data: ITradingViewIntervalConfigData) => {
      setIntervalConfig(data);
      handleCurrentKLineResolutionChange(data.activeInterval);
    },
    [handleCurrentKLineResolutionChange],
  );
  const handleNativeIntervalChange = useCallback(
    (interval: string) => {
      setIntervalConfig((prev) =>
        prev
          ? {
              ...prev,
              activeInterval: interval,
            }
          : prev,
      );
      handleCurrentKLineResolutionChange(interval);
      webRef.current?.sendMessageViaInjectedScript({
        type: TRADINGVIEW_INTERVAL_CHANGE_MESSAGE,
        payload: {
          interval,
          resetPriceScaleRange: true,
        },
      });
    },
    [handleCurrentKLineResolutionChange],
  );
  const handleNativeChartControlsConfigChange = useCallback(
    (data: ITradingViewNativeChartControlsConfigData) => {
      setNativeChartControlsConfig(data);
      if (data.intervals?.length && data.activeInterval) {
        setIntervalConfig({
          intervals: data.intervals,
          activeInterval: data.activeInterval,
          timestamp: data.timestamp,
        });
        handleCurrentKLineResolutionChange(data.activeInterval);
      }
    },
    [handleCurrentKLineResolutionChange],
  );
  const handleNativeIndicatorSelect = useCallback(
    (indicatorName: string, desiredActive: boolean) => {
      webRef.current?.sendMessageViaInjectedScript({
        type: TRADINGVIEW_INDICATOR_SELECT_MESSAGE,
        payload: {
          indicatorName,
          desiredActive,
        },
      });
    },
    [],
  );
  const handleNativeChartTypeChange = useCallback((chartType: number) => {
    setNativeChartControlsConfig((prev) =>
      prev
        ? {
            ...prev,
            activeChartType: chartType,
          }
        : prev,
    );
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_CHART_TYPE_CHANGE_MESSAGE,
      payload: {
        chartType,
      },
    });
  }, []);
  const handleNativeResetLayout = useCallback(() => {
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_RESET_LAYOUT_MESSAGE,
      payload: {},
    });
  }, []);
  const handleNativePriceScaleModeChange = useCallback(
    (priceScaleMode: ITradingViewPriceScaleMode) => {
      setNativeChartControlsConfig((prev) =>
        prev?.priceScale
          ? {
              ...prev,
              priceScale: {
                ...prev.priceScale,
                activeMode: priceScaleMode,
              },
            }
          : prev,
      );
      webRef.current?.sendMessageViaInjectedScript({
        type: TRADINGVIEW_PRICE_SCALE_CHANGE_MESSAGE,
        payload: {
          priceScaleMode,
        },
      });
    },
    [],
  );
  const handleNativePriceMarketCapModeChange = useCallback(
    (priceMarketCapMode: ITradingViewPriceMarketCapMode) => {
      setNativeChartControlsConfig((prev) =>
        prev?.priceMarketCap
          ? {
              ...prev,
              priceMarketCap: {
                ...prev.priceMarketCap,
                activeMode: priceMarketCapMode,
              },
            }
          : prev,
      );
      webRef.current?.sendMessageViaInjectedScript({
        type: TRADINGVIEW_PRICE_MARKET_CAP_CHANGE_MESSAGE,
        payload: {
          priceMarketCapMode,
        },
      });
    },
    [],
  );
  const handleNativeOpenChartSettings = useCallback(() => {
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_OPEN_CHART_SETTINGS_MESSAGE,
      payload: {},
    });
  }, []);
  const handleNativeControlInteraction = useCallback(() => {
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_CLOSE_POPUPS_AND_DIALOGS_MESSAGE,
      payload: {},
    });
  }, []);
  const handleNativeCalendarPanelSubmit = useCallback(
    (payload: ICalendarPanelSubmitPayload) => {
      webRef.current?.sendMessageViaInjectedScript({
        type: TRADINGVIEW_CALENDAR_PANEL_SUBMIT_MESSAGE,
        payload: {
          ...payload,
          resetPriceScaleRange: true,
        },
      });
    },
    [],
  );
  const handleNativeUndo = useCallback(() => {
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_UNDO_MESSAGE,
      payload: {},
    });
  }, []);
  const handleNativeRedo = useCallback(() => {
    webRef.current?.sendMessageViaInjectedScript({
      type: TRADINGVIEW_REDO_MESSAGE,
      payload: {},
    });
  }, []);

  const {
    isHyperLiquidSource,
    symbol: hyperLiquidSymbol,
    isLoading: isHyperLiquidSourceLoading,
  } = useHyperLiquidKlineSource(networkId, tokenAddress);
  const useHyperLiquid = Boolean(isHyperLiquidSource && hyperLiquidSymbol);
  const kLineProvider = useHyperLiquid ? 'hyperliquid' : 'onekey';
  const kLineProviderSymbol = useHyperLiquid ? hyperLiquidSymbol : undefined;
  const chartSymbol = useHyperLiquid ? (hyperLiquidSymbol ?? symbol) : symbol;
  const marketStorageNamespace = resolveMarketTradingViewStorageNamespace({
    isHyperLiquidSource: useHyperLiquid,
    storageNamespace,
  });
  const finalStorageNamespace = resolveTradingViewStorageNamespace({
    storageNamespace: marketStorageNamespace,
    forceCandlestickChart,
  });
  const bootstrapKLineResolution = normalizeTradingViewKLineInterval(
    (useHyperLiquid
      ? (initialHyperLiquidKLineResolution ?? initialKLineResolution)
      : initialKLineResolution) ?? DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  );
  const initialHyperLiquidPriceScale = useMemo(() => {
    if (!useHyperLiquid || marketPrice === undefined) {
      return undefined;
    }
    const price = String(marketPrice).trim();
    return price && Number(price) > 0
      ? calculateDisplayPriceScale(price)
      : undefined;
  }, [marketPrice, useHyperLiquid]);
  const marketSymbolIdentity = useMemo(
    () => ({
      symbol: chartSymbol,
      tokenAddress,
      networkId,
      decimal,
      initialHyperLiquidPriceScale,
    }),
    [
      chartSymbol,
      decimal,
      initialHyperLiquidPriceScale,
      networkId,
      tokenAddress,
    ],
  );
  const marketSymbolIdentityKey =
    buildMarketTradingViewIdentityKey(marketSymbolIdentity);
  const currentMarketSymbolIdentityKeyRef = useRef(marketSymbolIdentityKey);
  currentMarketSymbolIdentityKeyRef.current = marketSymbolIdentityKey;
  const hasActiveNonVolumeIndicator =
    nativeIndicatorState.isInitialized &&
    Array.from(nativeIndicatorState.activeIndicatorValues).some(
      (indicatorValue) => indicatorValue !== 'VOL',
    );

  useEffect(() => {
    currentKLineResolution.current = bootstrapKLineResolution;
    setActiveKLineResolution(bootstrapKLineResolution);
    setIsKLineHistoryReady(false);
  }, [bootstrapKLineResolution, marketSymbolIdentityKey]);

  const handleChartReady = useCallback(
    (_data: ITradingViewChartReadyData) => {
      syncTradingViewTheme(webRef.current, latestThemeRef.current);
      if (webRef.current && isDataRequestEnabledRef.current) {
        deliverInitialHistoryBootstrapRef.current?.(webRef.current);
      }
      onChartReady?.();
    },
    [onChartReady],
  );
  const handleHistoryReady = useCallback(
    (data: ITradingViewHistoryReadyData) => {
      if (!data.firstDataRequest) {
        return;
      }
      setIsKLineHistoryReady(data.status !== 'failed');
    },
    [],
  );
  const handleFirstPaintReady = useCallback(
    (data: ITradingViewFirstPaintReadyData) => {
      onFirstPaintReady?.(data);
    },
    [onFirstPaintReady],
  );
  const handleKLineDataReady = useCallback(
    (data: ITradingViewKLineDataReadyData) => {
      onKLineDataReady?.({ ...data, storageNamespace: finalStorageNamespace });
      if (
        isHistoryReadyAckSupported === false &&
        data.requestRange?.firstDataRequest
      ) {
        setIsKLineHistoryReady(true);
        onLegacyHistoryReady?.({
          status: 'success',
          period: data.period,
          symbol: chartSymbol,
          tokenAddress,
          networkId,
          webViewLoadGeneration: webViewLoadGeneration.current,
        });
      }
    },
    [
      chartSymbol,
      finalStorageNamespace,
      isHistoryReadyAckSupported,
      networkId,
      onKLineDataReady,
      onLegacyHistoryReady,
      tokenAddress,
    ],
  );
  const handleKLineLoadError = useCallback(
    (data: ITradingViewKLineLoadErrorData) => {
      onKLineLoadError?.({
        ...data,
        storageNamespace: finalStorageNamespace,
      });
      if (
        isHistoryReadyAckSupported === false &&
        data.requestRange?.firstDataRequest
      ) {
        const status = data.status === 'empty' ? 'empty' : 'failed';
        setIsKLineHistoryReady(status !== 'failed');
        onLegacyHistoryReady?.({
          status,
          period: data.period,
          symbol: chartSymbol,
          tokenAddress,
          networkId,
          webViewLoadGeneration: webViewLoadGeneration.current,
        });
      }
    },
    [
      chartSymbol,
      finalStorageNamespace,
      isHistoryReadyAckSupported,
      networkId,
      onKLineLoadError,
      onLegacyHistoryReady,
      tokenAddress,
    ],
  );
  const handleKLinePeriodChange = useCallback(
    (data: ITradingViewKLinePeriodChangeData) => {
      setIsKLineHistoryReady(false);
      onKLinePeriodChange?.({
        ...data,
        storageNamespace: finalStorageNamespace,
      });
    },
    [finalStorageNamespace, onKLinePeriodChange],
  );

  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    kLineProvider,
    kLineProviderSymbol,
    historyStartTime,
    webRef,
    onPanesCountChange,
    accountAddress,
    tokenSymbol: chartSymbol,
    marksTimeRange,
    webViewLoadGeneration,
    currentKLineResolution,
    onCurrentKLineResolutionChange: handleCurrentKLineResolutionChange,
    isDataRequestEnabled: () => isDataRequestEnabledRef.current,
    onTouchScroll,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    forceEmptyKLineData,
    emptyKLineDataOnError,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    onPrimaryKLineDataUnavailable,
    onPriceUpdate,
    onIntervalConfigChange: enableNativeIntervalSelector
      ? handleIntervalConfigChange
      : undefined,
    onNativeChartControlsConfigChange: enableNativeChartControls
      ? handleNativeChartControlsConfigChange
      : undefined,
    onMarketSymbolSyncSupportChange: setIsMarketSymbolSyncSupported,
    onMarketSymbolSyncStudiesSupportChange:
      setIsMarketSymbolSyncStudiesSupported,
    onMarketAppKlineTransportSupportChange:
      setIsMarketAppKlineTransportSupported,
    onHistoryReadyAckSupportChange: setIsHistoryReadyAckSupported,
    onChartReady: handleChartReady,
    onHistoryReady: handleHistoryReady,
    onFirstPaintReady: handleFirstPaintReady,
    isKLineHistoryReady,
    onKLineDataReady: handleKLineDataReady,
    onKLineLoadError: handleKLineLoadError,
    onKLinePeriodChange: handleKLinePeriodChange,
  });

  const shouldDeferWebRuntime = platformEnv.isWeb && isHyperLiquidSourceLoading;
  const effectiveDataSource =
    dataSource === 'websocket' && !tokenAddress ? 'polling' : dataSource;
  const mockEmptyKLineEnabled =
    devSettings.enabled &&
    devSettings.settings?.mockTradingViewKLineEmptyEnabled;
  const mockEmptyKLineIntervals =
    devSettings.settings?.mockTradingViewKLineEmptyIntervals;
  const mockEmptyKLineBadgeText = useMemo(
    () =>
      `Mock 空K线 ${formatMockEmptyKLineIntervals(mockEmptyKLineIntervals)}`,
    [mockEmptyKLineIntervals],
  );

  const staticAdditionalParams = useMemo(() => {
    return {
      type: 'market',
      storageNamespace: finalStorageNamespace,
      initialResolution: bootstrapKLineResolution,
      initialHistoryBootstrap: '1',
      marketSymbolSync: '1',
      ...(enableNativeIntervalSelector ? { nativeIntervalSelector: '1' } : {}),
      ...(enableNativeChartControls ? { nativeChartControls: '1' } : {}),
      ...(useHyperLiquid ? { scene: 'market-hyperliquid' } : {}),
      ...(useHyperLiquid ? { marketKlineTransport: 'app-v2' } : {}),
    };
  }, [
    bootstrapKLineResolution,
    enableNativeChartControls,
    enableNativeIntervalSelector,
    finalStorageNamespace,
    useHyperLiquid,
  ]);

  const { finalUrl: staticTradingViewUrl, timezone: tradingViewTimezone } =
    useTradingViewUrl({
      additionalParams: staticAdditionalParams,
      disabledFeatures,
      theme,
    });
  const effectiveMarketSymbolSyncSupport =
    hasActiveNonVolumeIndicator && isMarketSymbolSyncStudiesSupported !== true
      ? false
      : isMarketSymbolSyncSupported;
  const {
    staticTradingViewUrl: frameStaticTradingViewUrl,
    identity: frameIdentity,
  } = useMarketTradingViewFrameIdentity({
    staticTradingViewUrl,
    identity: marketSymbolIdentity,
    symbolSyncSupport: effectiveMarketSymbolSyncSupport,
  });
  const tradingViewUrlWithParams = useMemo(
    () =>
      buildMarketTradingViewUrl({
        baseUrl: frameStaticTradingViewUrl,
        identity: frameIdentity,
      }),
    [frameIdentity, frameStaticTradingViewUrl],
  );
  const { handleNavigation } = useNavigationHandler();
  useMarketSymbolSync({
    webRef,
    identity: marketSymbolIdentity,
    frameIdentity,
    documentGeneration: webViewLoadGeneration.current,
    enabled: isVisible && effectiveMarketSymbolSyncSupport === true,
    // React Navigation briefly renders the next detail identity through the
    // outgoing Web screen. Let its cleanup cancel that redundant symbol switch.
    deliveryDelayMs: platformEnv.isWeb ? 150 : 0,
  });
  const tradingViewWebViewStyleProps = useMemo(
    () => ({
      containerStyle: { backgroundColor: tradingViewBackgroundColor },
      style: { backgroundColor: tradingViewBackgroundColor },
    }),
    [tradingViewBackgroundColor],
  );

  const canUseAppKLineRealtime =
    isVisible &&
    isKLineHistoryReady &&
    !isHyperLiquidSourceLoading &&
    (!useHyperLiquid || isMarketAppKlineTransportSupported === true) &&
    !mockEmptyKLineEnabled &&
    !forceEmptyKLineData;
  const shouldUseWebSocketKLine =
    canUseAppKLineRealtime &&
    !useHyperLiquid &&
    effectiveDataSource === 'websocket';

  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    kLineProvider,
    kLineProviderSymbol,
    webRef,
    symbol: chartSymbol,
    resolution: activeKLineResolution,
    enabled:
      canUseAppKLineRealtime &&
      !primaryKLineDataUnavailable &&
      (useHyperLiquid || effectiveDataSource === 'polling'),
    autoHandleError: emptyKLineDataOnError ? false : undefined,
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible,
  });

  useTradingViewV2WebSocket({
    tokenAddress,
    networkId,
    webRef,
    enabled: shouldUseWebSocketKLine,
    chartType: activeKLineResolution,
    symbol: chartSymbol,
  });

  useEffect(() => {
    syncTradingViewTheme(webRef.current, theme);
  }, [theme]);

  // Load marks on page enter and refresh when swap transaction succeeds
  useEffect(() => {
    if (
      !isVisible ||
      !isKLineHistoryReady ||
      !accountAddress ||
      !tokenAddress ||
      !networkId
    ) {
      return;
    }
    if (forceEmptyKLineData) return;

    const refreshMarks = () => {
      const now = Math.floor(Date.now() / 1000);

      // Use the tracked time range if available, otherwise default to recent period
      const timeRange = marksTimeRange.current || {
        min: now - 86_400 * 30, // Default: 30 days
        max: now,
      };

      void fetchAndSendAccountMarks({
        accountAddress,
        tokenAddress,
        networkId,
        from: timeRange.min,
        to: timeRange.max,
        symbol: chartSymbol,
        resolution: currentKLineResolution.current,
        webRef,
        webViewLoadGeneration,
      });
    };

    // Reset time range when token/account changes, then load marks
    marksTimeRange.current = null;
    refreshMarks();

    const handleSwapSuccess = (payload: {
      status: ESwapTxHistoryStatus;
      fromToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
      toToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
    }) => {
      if (
        payload.status !== ESwapTxHistoryStatus.SUCCESS &&
        payload.status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }

      // Check if current token matches fromToken or toToken
      const fromAddr =
        payload.fromToken?.contractAddress || payload.fromToken?.address;
      const toAddr =
        payload.toToken?.contractAddress || payload.toToken?.address;
      const isMatch =
        (payload.fromToken?.networkId === networkId &&
          fromAddr === tokenAddress) ||
        (payload.toToken?.networkId === networkId && toAddr === tokenAddress);

      if (!isMatch) return;

      refreshMarks();
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapSuccess,
      );
    };
  }, [
    isVisible,
    isKLineHistoryReady,
    accountAddress,
    tokenAddress,
    networkId,
    chartSymbol,
    mockEmptyKLineEnabled,
    mockEmptyKLineIntervals,
    forceEmptyKLineData,
    webRef,
  ]);

  const deliverInitialHistoryBootstrap = useCallback(
    (ref: IWebViewRef) => {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;

      const requestTarget = captureTradingViewRequestTarget({
        webRef,
        webViewLoadGeneration,
        isRequestCurrent: () =>
          isDataRequestEnabledRef.current &&
          currentMarketSymbolIdentityKeyRef.current ===
            marketSymbolIdentityKey &&
          normalizeTradingViewKLineInterval(currentKLineResolution.current) ===
            bootstrapKLineResolution,
      });
      if (requestTarget.requestWebView !== ref) {
        return;
      }

      const identity = {
        symbol: chartSymbol,
        tokenAddress,
        networkId,
        decimal: decimal.toString(),
      };
      const bootstrapIdPrefix = [
        kLineProvider,
        kLineProviderSymbol ?? '',
        networkId,
        tokenAddress,
        chartSymbol,
        bootstrapKLineResolution,
      ].join(':');
      const sendUnavailable = (reason: string) => {
        requestTarget.sendMessage({
          type: 'KLINE_BOOTSTRAP_UNAVAILABLE',
          payload: {
            protocolVersion: KLINE_BOOTSTRAP_PROTOCOL_VERSION,
            bootstrapId: `${bootstrapIdPrefix}:unavailable:${reason}`,
            identity,
            resolution: bootstrapKLineResolution,
            reason,
          },
        });
      };

      if (
        forceEmptyKLineData ||
        mockEmptyKLineEnabled ||
        primaryKLineDataUnavailable ||
        kLineDataFallback
      ) {
        sendUnavailable('prefetch-disabled');
        return;
      }

      cancelInitialHistoryBootstrapSubscriptionRef.current =
        subscribeTradingViewV2FirstScreenPrefetch({
          tokenAddress,
          networkId,
          interval: bootstrapKLineResolution,
          kLineProvider,
          kLineProviderSymbol,
          historyStartTime,
          onResult: (result) => {
            if (!requestTarget.isCurrent()) {
              return;
            }
            if (
              !result ||
              (!result.points.length && !result.historyExhausted)
            ) {
              sendUnavailable('prefetch-empty');
              return;
            }

            requestTarget.sendMessage({
              type: 'KLINE_BOOTSTRAP',
              payload: {
                protocolVersion: KLINE_BOOTSTRAP_PROTOCOL_VERSION,
                bootstrapId: [
                  bootstrapIdPrefix,
                  result.requestedTimeTo,
                  result.coveredTimeFrom,
                  result.points.length,
                ].join(':'),
                identity,
                resolution: result.interval,
                coveredRange: {
                  fromInclusive: result.coveredTimeFrom,
                  toExclusive: result.coveredTimeTo,
                },
                historyExhausted: result.historyExhausted,
                points: result.points,
                historyMeta: result.historyMeta,
              },
            });
          },
          onError: () => sendUnavailable('prefetch-failed'),
        });

      void prefetchTradingViewV2FirstScreenData({
        tokenAddress,
        networkId,
        interval: bootstrapKLineResolution,
        kLineProvider,
        kLineProviderSymbol,
        historyStartTime,
      });
    },
    [
      bootstrapKLineResolution,
      chartSymbol,
      decimal,
      forceEmptyKLineData,
      historyStartTime,
      kLineDataFallback,
      kLineProvider,
      kLineProviderSymbol,
      marketSymbolIdentityKey,
      mockEmptyKLineEnabled,
      networkId,
      primaryKLineDataUnavailable,
      tokenAddress,
    ],
  );
  deliverInitialHistoryBootstrapRef.current = deliverInitialHistoryBootstrap;

  useEffect(() => {
    if (!isVisible || !webRef.current) {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      return;
    }
    deliverInitialHistoryBootstrap(webRef.current);
  }, [deliverInitialHistoryBootstrap, isVisible]);

  useEffect(
    () => () => {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
    },
    [],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  const resetIndicatorsDialogOpen = useCallback(() => {
    onIndicatorsDialogOpenChange?.(false);
  }, [onIndicatorsDialogOpenChange]);

  const resetInteractionOverlayOpen = useCallback(() => {
    onInteractionOverlayOpenChange?.(false);
  }, [onInteractionOverlayOpenChange]);

  const resetInteractionLocks = useCallback(() => {
    resetIndicatorsDialogOpen();
    resetInteractionOverlayOpen();
  }, [resetIndicatorsDialogOpen, resetInteractionOverlayOpen]);

  const handleLoadStart = useCallback(
    (event: WebViewNavigationEvent) => {
      webViewLoadGeneration.current += 1;
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      setIsKLineHistoryReady(false);
      setIsMarketSymbolSyncSupported(undefined);
      setIsMarketSymbolSyncStudiesSupported(undefined);
      setIsMarketAppKlineTransportSupported(undefined);
      setIsHistoryReadyAckSupported(undefined);
      setIntervalConfig(null);
      setNativeChartControlsConfig(null);
      resetInteractionLocks();
      onLoadStart?.(event);
    },
    [onLoadStart, resetInteractionLocks],
  );

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      syncTradingViewTheme(webRef.current, latestThemeRef.current);
      if (isVisible && webRef.current) {
        deliverInitialHistoryBootstrap(webRef.current);
      }
      onLoadEnd?.(event);
    },
    [deliverInitialHistoryBootstrap, isVisible, onLoadEnd],
  );

  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      if (!ref) {
        resetInteractionLocks();
      }
      webRef.current = ref;
      if (ref && isDataRequestEnabledRef.current) {
        deliverInitialHistoryBootstrapRef.current?.(ref);
      }
    },
    [resetInteractionLocks, webRef],
  );

  const handleContentProcessDidTerminate = useCallback(
    (event: WebViewTerminatedEvent) => {
      webRef.current?.reload();
      onContentProcessDidTerminate?.(event);
    },
    [onContentProcessDidTerminate],
  );

  const isNativeIndicatorQuickBarAvailabilityResolved =
    !enableNativeChartControls ||
    !showNativeIndicatorQuickBar ||
    nativeChartControlsConfig !== null;

  const nativeIndicatorQuickBar = useMemo(() => {
    if (
      !enableNativeChartControls ||
      !showNativeIndicatorQuickBar ||
      !nativeChartControlsConfig ||
      nativeChartControlsConfig.indicatorsEnabled === false
    ) {
      return null;
    }

    return (
      <TradingViewNativeIndicatorQuickBar
        nativeChartControlsConfig={nativeChartControlsConfig}
        nativeIndicatorState={nativeIndicatorState}
        maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
        splitSections={nativeControlsLayoutMode === 'mobile'}
        onIndicatorSelect={handleNativeIndicatorSelect}
        onControlInteraction={handleNativeControlInteraction}
      />
    );
  }, [
    enableNativeChartControls,
    handleNativeControlInteraction,
    handleNativeIndicatorSelect,
    maxSelectableSubIndicatorCount,
    nativeChartControlsConfig,
    nativeIndicatorState,
    nativeControlsLayoutMode,
    showNativeIndicatorQuickBar,
  ]);

  const nativeIndicatorQuickBarState =
    useMemo<ITradingViewNativeIndicatorQuickBarState>(() => {
      return resolveTradingViewNativeIndicatorQuickBarState({
        isAvailabilityResolved: isNativeIndicatorQuickBarAvailabilityResolved,
        quickBar: nativeIndicatorQuickBar,
      });
    }, [
      isNativeIndicatorQuickBarAvailabilityResolved,
      nativeIndicatorQuickBar,
    ]);

  useEffect(() => {
    onNativeIndicatorQuickBarChange?.(nativeIndicatorQuickBarState);
  }, [nativeIndicatorQuickBarState, onNativeIndicatorQuickBarChange]);

  useEffect(() => {
    return () => {
      resetInteractionLocks();
    };
  }, [resetInteractionLocks]);

  useEffect(() => {
    if (!onNativeIndicatorQuickBarChange) {
      return undefined;
    }

    return () => {
      onNativeIndicatorQuickBarChange({
        status: 'loading',
        quickBar: null,
      });
    };
  }, [onNativeIndicatorQuickBarChange]);

  const handleMockEmptyKLineBadgePress = useCallback(() => {
    setMockEmptyKLineBadgePositionIndex(
      (positionIndex) =>
        (positionIndex + 1) % MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES.length,
    );
  }, []);

  const webView = useMemo(
    () =>
      shouldDeferWebRuntime ? null : (
        <TradingViewRuntimeView
          key={tradingViewUrlWithParams}
          containerProps={{ bg: '$bgApp' }}
          containerStyle={tradingViewWebViewStyleProps.containerStyle}
          style={tradingViewWebViewStyleProps.style}
          customReceiveHandler={async (data) => {
            const receiveData = data as ICustomReceiveHandlerData;
            await customReceiveHandler(receiveData);
          }}
          useInjectedNativeCode={platformEnv.isNative ? false : undefined}
          nativeInjectedJavaScriptBeforeContentLoaded={
            platformEnv.isNative
              ? TRADING_VIEW_NATIVE_MINIMAL_BRIDGE_SCRIPT
              : undefined
          }
          skipBackgroundBridge={platformEnv.isNative}
          cacheEnabled={platformEnv.isNative ? true : undefined}
          useSharedProcessPool={platformEnv.isNative ? true : undefined}
          onChartError={onChartError}
          onVisualReady={onVisualReady}
          onWebViewRef={handleWebViewRef}
          allowsBackForwardNavigationGestures={false}
          onLoadEnd={handleLoadEnd}
          onLoadStart={handleLoadStart}
          onContentProcessDidTerminate={handleContentProcessDidTerminate}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          displayProgressBar={false}
          pullToRefreshEnabled={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
          src={tradingViewUrlWithParams}
        />
      ),
    [
      customReceiveHandler,
      handleLoadEnd,
      handleLoadStart,
      handleContentProcessDidTerminate,
      handleWebViewRef,
      onShouldStartLoadWithRequest,
      onChartError,
      onVisualReady,
      shouldDeferWebRuntime,
      tradingViewUrlWithParams,
      tradingViewWebViewStyleProps,
    ],
  );

  return (
    <Stack flex={1} {...stackStyle}>
      {enableNativeIntervalSelector ? (
        <TradingViewV2ChartControlsContainer
          enableNativeChartSettings={enableNativeChartSettings}
          intervalConfig={intervalConfig}
          nativeChartControlsConfig={nativeChartControlsConfig}
          nativeIndicatorState={nativeIndicatorState}
          maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
          isControlsReady={isNativeChartControlsReady}
          chartTypeControlMode={nativeChartTypeControlMode}
          indicatorControlMode={nativeIndicatorControlMode}
          intervalControlMode={nativeIntervalControlMode}
          priceMarketCapControlMode={nativePriceMarketCapControlMode}
          layoutMode={nativeControlsLayoutMode}
          chartTimezone={tradingViewTimezone}
          isFullscreen={isNativeChartFullscreen}
          fullscreenHeader={nativeChartFullscreenHeader}
          onChartSwitch={onChartSwitch}
          onIntervalChange={handleNativeIntervalChange}
          onIndicatorSelect={handleNativeIndicatorSelect}
          onChartTypeChange={handleNativeChartTypeChange}
          onResetLayout={handleNativeResetLayout}
          onPriceScaleModeChange={handleNativePriceScaleModeChange}
          onPriceMarketCapModeChange={handleNativePriceMarketCapModeChange}
          onOpenChartSettings={handleNativeOpenChartSettings}
          onControlInteraction={handleNativeControlInteraction}
          onCalendarPanelSubmit={handleNativeCalendarPanelSubmit}
          onUndo={handleNativeUndo}
          onRedo={handleNativeRedo}
          onFullscreenChange={onNativeChartFullscreenChange}
        />
      ) : null}

      <Stack position="relative" flex={1}>
        {webView}

        {mockEmptyKLineEnabled ? (
          <Stack
            position="absolute"
            zIndex={2}
            px="$2"
            py="$1"
            borderRadius="$1"
            bg="#D92D20"
            cursor="pointer"
            maxWidth={220}
            onPress={handleMockEmptyKLineBadgePress}
            {...MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES[
              mockEmptyKLineBadgePositionIndex
            ]}
          >
            <SizableText size="$bodyXsMedium" color="white" numberOfLines={2}>
              {mockEmptyKLineBadgeText}
            </SizableText>
          </Stack>
        ) : null}

        {platformEnv.isNativeIOS ? (
          <Stack
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            width={15}
            zIndex={1}
            pointerEvents="auto"
          />
        ) : null}
      </Stack>

      {onNativeIndicatorQuickBarChange ? null : nativeIndicatorQuickBar}
    </Stack>
  );
};
