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
  useNavigationHandler,
  useTradingViewUrl,
} from '@onekeyhq/kit/src/components/TradingView/hooks';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { ITradingViewKLineMockEmptyInterval } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  TradingViewNativeChartControls,
  TradingViewNativeIndicatorQuickBar,
  getTradingViewNativeSubIndicatorCount,
  getTradingViewNativeSubIndicatorCountFromOptions,
  useNativeIndicatorActiveValues,
} from '../TradingViewNativeChartControls';

import {
  buildMarketTradingViewIdentityKey,
  buildMarketTradingViewUrl,
  prefetchTradingViewV2FirstScreenData,
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
import { TRADING_VIEW_NATIVE_MINIMAL_BRIDGE_SCRIPT } from './nativeTradingViewBridge';

import type { ITradingViewV2KLineDataFallback } from './hooks/useTradingViewV2';
import type { IMarksTimeRange } from './messageHandlers';
import type {
  ICustomReceiveHandlerData,
  ITradingViewChartReadyData,
  ITradingViewFirstPaintReadyData,
  ITradingViewHistoryData,
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
const TRADINGVIEW_CAPABILITY_HANDSHAKE_TIMEOUT_MS = 5000;
const MARKET_SYMBOL_SYNC_RECOVERY_TIMEOUT_MS = 3000;
const MAX_READINESS_ACK_TARGETS = 200;

interface IPendingLegacyHistoryReady {
  readyKey: string;
  status: ITradingViewHistoryReadyData['status'];
  period: string;
  webViewLoadGeneration: number;
}

interface IReadinessAckTarget {
  identity: string;
  webViewLoadGeneration: number;
}

function buildKLineHistoryReadyKey({
  networkId,
  tokenAddress,
  symbol,
  resolution,
}: {
  networkId: string;
  tokenAddress: string;
  symbol: string;
  resolution: string;
}) {
  return [
    networkId.trim(),
    tokenAddress.trim(),
    symbol.trim(),
    normalizeTradingViewKLineInterval(resolution),
  ].join(':');
}

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
  historyStartTime?: number;
  initialKLineResolution?: string;
  initialHyperLiquidKLineResolution?: string;
  decimal: number;
  marketPrice?: string | number;
  onPanesCountChange?: (count: number) => void;
  dataSource?: 'websocket' | 'polling';
  accountAddress?: string;
  enabled?: boolean;
  isVisibilityManagedExternally?: boolean;
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
  enableNativeIntervalSelector?: boolean;
  maxNativeSubIndicatorCount?: number;
  // `null` means the WebView controls configuration is not ready.
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  nativeChartTypeControlMode?: ITradingViewNativeChartTypeControlMode;
  nativeIndicatorControlMode?: ITradingViewNativeIndicatorControlMode;
  nativeIntervalControlMode?: ITradingViewNativeIntervalControlMode;
  nativePriceMarketCapControlMode?: ITradingViewNativePriceMarketCapControlMode;
  nativeControlsLayoutMode?: ITradingViewNativeControlsLayoutMode;
  isNativeChartFullscreen?: boolean;
  showNativeIndicatorQuickBar?: boolean;
  onNativeIndicatorQuickBarChange?: (quickBar: ReactNode | null) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onKLineDataReady?: (data: ITradingViewKLineDataReadyData) => void;
  onKLineLoadError?: (data: ITradingViewKLineLoadErrorData) => void;
  onKLinePeriodChange?: (data: ITradingViewKLinePeriodChangeData) => void;
  onChartReady?: (data: ITradingViewChartReadyData) => void;
  onLegacyHistoryReady?: (data: ITradingViewLegacyHistoryReadyData) => void;
  onFirstPaintReady?: (data: ITradingViewFirstPaintReadyData) => void;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const {
    tokenAddress: kLineSourceTokenAddress = '',
    networkId: kLineSourceNetworkId = '',
    symbol: displaySymbol,
    initialKLineResolution: initialKLineResolutionProp,
    initialHyperLiquidKLineResolution: initialHyperLiquidKLineResolutionProp,
  } = props;
  const {
    isHyperLiquidSource,
    symbol: hyperLiquidSymbol,
    isLoading: isKLineSourceLoading,
  } = useHyperLiquidKlineSource(kLineSourceNetworkId, kLineSourceTokenAddress);
  const useHyperLiquid = Boolean(isHyperLiquidSource && hyperLiquidSymbol);
  const kLineProvider = useHyperLiquid ? 'hyperliquid' : 'onekey';
  const kLineProviderSymbol = useHyperLiquid ? hyperLiquidSymbol : undefined;
  const chartSymbol = useHyperLiquid
    ? (hyperLiquidSymbol ?? displaySymbol)
    : displaySymbol;
  const requestedInitialResolution = useHyperLiquid
    ? (initialHyperLiquidKLineResolutionProp ?? initialKLineResolutionProp)
    : initialKLineResolutionProp;
  const webRef = useRef<IWebViewRef | null>(null);
  const webViewLoadGeneration = useRef(0);
  const capabilityHandshakeTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const capabilityHandshakeSettledGenerationRef = useRef<number | null>(null);
  const cancelInitialHistoryBootstrapSubscriptionRef = useRef<
    (() => void) | undefined
  >(undefined);
  const marketSymbolSyncRecoveryTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const initialHistoryBootstrapSentIdentityRef = useRef<string | undefined>(
    undefined,
  );
  const successfulFirstPaintRef = useRef<
    | {
        identity: string;
        webViewLoadGeneration: number;
      }
    | undefined
  >(undefined);
  const marksTimeRange = useRef<IMarksTimeRange | null>(null);
  const pendingLegacyHistoryReadyRef =
    useRef<IPendingLegacyHistoryReady | null>(null);
  const notifiedLegacyHistoryReadyKeyRef = useRef<string | null>(null);
  const firstPaintTrackingRef = useRef({
    identity: '',
    startedAt: Date.now(),
    hasTracked: false,
    requestIds: new Set<string>(),
  });
  const readinessAckTargetsRef = useRef(new Map<string, IReadinessAckTarget>());
  const bootstrapKLineResolution = normalizeTradingViewKLineInterval(
    requestedInitialResolution ?? DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  );
  const currentKLineResolution = useRef(bootstrapKLineResolution);
  const [activeKLineResolution, setActiveKLineResolution] = useState(
    bootstrapKLineResolution,
  );
  const [firstHistoryReadyKey, setFirstHistoryReadyKey] = useState<
    string | null
  >(null);
  const [
    forceReloadMarketSymbolIdentityKey,
    setForceReloadMarketSymbolIdentityKey,
  ] = useState<string | undefined>(undefined);
  const [intervalConfig, setIntervalConfig] =
    useState<ITradingViewIntervalConfigData | null>(null);
  const [nativeChartControlsConfig, setNativeChartControlsConfig] =
    useState<ITradingViewNativeChartControlsConfigData | null>(null);
  const [isMarketSymbolSyncSupported, setIsMarketSymbolSyncSupported] =
    useState<boolean | undefined>();
  const [
    isMarketAppKlineTransportSupported,
    setIsMarketAppKlineTransportSupported,
  ] = useState<boolean | undefined>();
  const [isIntervalAckSupported, setIsIntervalAckSupported] = useState<
    boolean | undefined
  >();
  const [isHistoryReadyAckSupported, setIsHistoryReadyAckSupported] = useState<
    boolean | undefined
  >();
  const isHistoryReadyAckSupportedRef = useRef(isHistoryReadyAckSupported);
  isHistoryReadyAckSupportedRef.current = isHistoryReadyAckSupported;
  const nativeIndicatorState = useNativeIndicatorActiveValues(
    nativeChartControlsConfig?.indicators,
  );
  const theme = useThemeVariant();
  const themeColors = useTheme();
  const tradingViewBackgroundColor = themeColors.bgApp.val;
  const isRouteFocused = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [
    mockEmptyKLineBadgePositionIndex,
    setMockEmptyKLineBadgePositionIndex,
  ] = useState(0);

  const {
    tokenAddress = '',
    networkId = '',
    historyStartTime,
    symbol,
    decimal,
    marketPrice,
    onPanesCountChange,
    dataSource,
    accountAddress,
    enabled = true,
    isVisibilityManagedExternally = false,
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
    enableNativeIntervalSelector: enableNativeIntervalSelectorProp = false,
    maxNativeSubIndicatorCount,
    onNativeSubIndicatorCountChange,
    nativeChartTypeControlMode,
    nativeIndicatorControlMode,
    nativeIntervalControlMode,
    nativePriceMarketCapControlMode,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    showNativeIndicatorQuickBar = true,
    onNativeIndicatorQuickBarChange,
    onNativeChartFullscreenChange,
    onKLineDataReady,
    onKLineLoadError,
    onKLinePeriodChange,
    onChartReady,
    onLegacyHistoryReady,
    onFirstPaintReady,
    onLoadStart,
    onLoadEnd,
    onContentProcessDidTerminate,
    ...stackStyle
  } = props;
  const isVisible =
    enabled && (isVisibilityManagedExternally || isRouteFocused);
  const isDataRequestEnabledRef = useRef(isVisible);
  isDataRequestEnabledRef.current = isVisible;
  const isDataRequestEnabled = useCallback(
    () => isDataRequestEnabledRef.current,
    [],
  );
  const clearCapabilityHandshakeTimer = useCallback(() => {
    if (capabilityHandshakeTimerRef.current !== undefined) {
      clearTimeout(capabilityHandshakeTimerRef.current);
      capabilityHandshakeTimerRef.current = undefined;
    }
  }, []);
  const clearMarketSymbolSyncRecoveryTimer = useCallback(() => {
    if (marketSymbolSyncRecoveryTimerRef.current !== undefined) {
      clearTimeout(marketSymbolSyncRecoveryTimerRef.current);
      marketSymbolSyncRecoveryTimerRef.current = undefined;
    }
  }, []);
  const fallbackToLegacyCapabilities = useCallback((loadGeneration: number) => {
    if (webViewLoadGeneration.current !== loadGeneration) {
      return;
    }

    capabilityHandshakeSettledGenerationRef.current = loadGeneration;
    setIsMarketSymbolSyncSupported((supported) => supported ?? false);
    setIsMarketAppKlineTransportSupported((supported) => supported ?? false);
    setIsIntervalAckSupported((supported) => supported ?? false);
    setIsHistoryReadyAckSupported((supported) => supported ?? false);
  }, []);
  const handleChartReady = useCallback(
    (data: ITradingViewChartReadyData) => {
      capabilityHandshakeSettledGenerationRef.current =
        webViewLoadGeneration.current;
      clearCapabilityHandshakeTimer();
      onChartReady?.(data);
    },
    [clearCapabilityHandshakeTimer, onChartReady],
  );
  const enableNativeChartControls = Boolean(enableNativeChartControlsProp);
  const enableNativeIntervalSelector =
    enableNativeIntervalSelectorProp || enableNativeChartControls;
  const hasNativeChartControlsConfig = Boolean(nativeChartControlsConfig);
  const isNativeChartControlsReady =
    !enableNativeChartControls || hasNativeChartControlsConfig;
  const nativeSubIndicatorCountFromConfig = useMemo(
    () =>
      getTradingViewNativeSubIndicatorCountFromOptions(
        nativeChartControlsConfig?.indicators,
      ),
    [nativeChartControlsConfig?.indicators],
  );
  const nativeSubIndicatorCountFromAppState = useMemo(
    () =>
      getTradingViewNativeSubIndicatorCount(
        nativeIndicatorState.activeIndicatorValues,
      ),
    [nativeIndicatorState.activeIndicatorValues],
  );
  const nativeSubIndicatorCount = useMemo(
    () =>
      nativeIndicatorState.isInitialized
        ? nativeSubIndicatorCountFromAppState
        : nativeSubIndicatorCountFromConfig,
    [
      nativeIndicatorState.isInitialized,
      nativeSubIndicatorCountFromAppState,
      nativeSubIndicatorCountFromConfig,
    ],
  );

  useEffect(() => {
    if (!enableNativeChartControls) {
      return;
    }
    onNativeSubIndicatorCountChange?.(
      hasNativeChartControlsConfig ? nativeSubIndicatorCount : null,
    );
  }, [
    enableNativeChartControls,
    hasNativeChartControlsConfig,
    nativeSubIndicatorCount,
    onNativeSubIndicatorCountChange,
  ]);

  const { handleNavigation } = useNavigationHandler();
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
  useEffect(() => {
    if (isKLineSourceLoading) {
      return;
    }
    currentKLineResolution.current = bootstrapKLineResolution;
    setActiveKLineResolution(bootstrapKLineResolution);
  }, [
    bootstrapKLineResolution,
    isKLineSourceLoading,
    kLineSourceNetworkId,
    kLineSourceTokenAddress,
  ]);
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

  const initialHyperLiquidPriceScale = useMemo(() => {
    if (!useHyperLiquid || marketPrice === undefined) {
      return undefined;
    }
    const priceScale = calculateDisplayPriceScale(marketPrice);
    return Number.isFinite(priceScale) && priceScale > 0
      ? priceScale
      : undefined;
  }, [marketPrice, useHyperLiquid]);
  const finalStorageNamespace =
    storageNamespace?.trim() ||
    (useHyperLiquid ? 'market-hyperliquid' : 'market');
  const initialResolutionForFrame = requestedInitialResolution
    ? normalizeTradingViewKLineInterval(requestedInitialResolution)
    : undefined;
  const currentHistoryReadyKey = buildKLineHistoryReadyKey({
    networkId,
    tokenAddress,
    symbol: chartSymbol,
    resolution: activeKLineResolution,
  });
  const firstPaintMetricIdentity = [
    networkId,
    tokenAddress,
    chartSymbol,
    kLineProvider,
  ].join(':');
  const registerReadinessAckTarget = useCallback(
    (correlationId: string) => {
      readinessAckTargetsRef.current.set(correlationId, {
        identity: firstPaintMetricIdentity,
        webViewLoadGeneration: webViewLoadGeneration.current,
      });
      if (readinessAckTargetsRef.current.size > MAX_READINESS_ACK_TARGETS) {
        const oldestCorrelationId = readinessAckTargetsRef.current
          .keys()
          .next().value;
        if (typeof oldestCorrelationId === 'string') {
          readinessAckTargetsRef.current.delete(oldestCorrelationId);
        }
      }
    },
    [firstPaintMetricIdentity],
  );
  const handleKLineRequestStart = useCallback(
    (data: ITradingViewHistoryData) => {
      if (data.requestId) {
        registerReadinessAckTarget(data.requestId);
      }
    },
    [registerReadinessAckTarget],
  );
  const resolveReadinessAckTarget = useCallback(
    (
      data: ITradingViewHistoryReadyData | ITradingViewFirstPaintReadyData,
    ): boolean | undefined => {
      const correlationId =
        'source' in data && data.source === 'bootstrap'
          ? (data.bootstrapId ?? data.requestId)
          : data.requestId;
      const target = readinessAckTargetsRef.current.get(correlationId);
      if (!target) {
        return undefined;
      }
      return (
        target.identity === firstPaintMetricIdentity &&
        target.webViewLoadGeneration === webViewLoadGeneration.current
      );
    },
    [firstPaintMetricIdentity],
  );
  const currentDataRequestIdentityRef = useRef(firstPaintMetricIdentity);
  currentDataRequestIdentityRef.current = firstPaintMetricIdentity;
  if (firstPaintTrackingRef.current.identity !== firstPaintMetricIdentity) {
    firstPaintTrackingRef.current.identity = firstPaintMetricIdentity;
    firstPaintTrackingRef.current.startedAt = Date.now();
    firstPaintTrackingRef.current.hasTracked = false;
    firstPaintTrackingRef.current.requestIds.clear();
    successfulFirstPaintRef.current = undefined;
  }
  const isKLineHistoryReady = firstHistoryReadyKey === currentHistoryReadyKey;
  const isKLineHistoryReadyRef = useRef(isKLineHistoryReady);
  isKLineHistoryReadyRef.current = isKLineHistoryReady;
  useEffect(() => {
    if (isKLineHistoryReady) {
      clearMarketSymbolSyncRecoveryTimer();
      initialHistoryBootstrapSentIdentityRef.current = undefined;
    }
  }, [clearMarketSymbolSyncRecoveryTimer, isKLineHistoryReady]);
  const commitLegacyHistoryReady = useCallback(
    (candidate: IPendingLegacyHistoryReady) => {
      if (
        candidate.webViewLoadGeneration !== webViewLoadGeneration.current ||
        candidate.readyKey !== currentHistoryReadyKey
      ) {
        return;
      }

      if (candidate.status === 'failed') {
        setFirstHistoryReadyKey((readyKey) =>
          readyKey === candidate.readyKey ? null : readyKey,
        );
      } else {
        setFirstHistoryReadyKey(candidate.readyKey);
      }

      const notificationKey = [
        candidate.webViewLoadGeneration,
        candidate.readyKey,
        candidate.status,
      ].join(':');
      if (notifiedLegacyHistoryReadyKeyRef.current === notificationKey) {
        return;
      }
      notifiedLegacyHistoryReadyKeyRef.current = notificationKey;
      onLegacyHistoryReady?.({
        status: candidate.status,
        period: candidate.period,
        symbol: displaySymbol,
        tokenAddress,
        networkId,
        webViewLoadGeneration: candidate.webViewLoadGeneration,
      });
    },
    [
      currentHistoryReadyKey,
      displaySymbol,
      networkId,
      onLegacyHistoryReady,
      tokenAddress,
    ],
  );
  useEffect(() => {
    const candidate = pendingLegacyHistoryReadyRef.current;
    if (isHistoryReadyAckSupported === false && candidate) {
      commitLegacyHistoryReady(candidate);
    }
  }, [commitLegacyHistoryReady, isHistoryReadyAckSupported]);
  const handleKLineDataReady = useCallback(
    (data: ITradingViewKLineDataReadyData) => {
      if (data.requestRange?.firstDataRequest) {
        const readyKey = buildKLineHistoryReadyKey({
          networkId,
          tokenAddress,
          symbol: chartSymbol,
          resolution: data.period,
        });
        const candidate: IPendingLegacyHistoryReady = {
          readyKey,
          status: 'success',
          period: data.period,
          webViewLoadGeneration: webViewLoadGeneration.current,
        };
        pendingLegacyHistoryReadyRef.current = candidate;
        if (isHistoryReadyAckSupportedRef.current === false) {
          commitLegacyHistoryReady(candidate);
        }
      }
      onKLineDataReady?.({ ...data, storageNamespace: finalStorageNamespace });
    },
    [
      chartSymbol,
      commitLegacyHistoryReady,
      finalStorageNamespace,
      networkId,
      onKLineDataReady,
      tokenAddress,
    ],
  );
  const handleKLineLoadError = useCallback(
    (data: ITradingViewKLineLoadErrorData) => {
      if (
        data.requestRange?.firstDataRequest &&
        (data.status === 'empty' || data.status === 'failed')
      ) {
        const readyKey = buildKLineHistoryReadyKey({
          networkId,
          tokenAddress,
          symbol: chartSymbol,
          resolution: data.period,
        });
        const candidate: IPendingLegacyHistoryReady = {
          readyKey,
          status: data.status,
          period: data.period,
          webViewLoadGeneration: webViewLoadGeneration.current,
        };
        pendingLegacyHistoryReadyRef.current = candidate;
        if (isHistoryReadyAckSupportedRef.current === false) {
          commitLegacyHistoryReady(candidate);
        }
      }
      onKLineLoadError?.({ ...data, storageNamespace: finalStorageNamespace });
    },
    [
      chartSymbol,
      commitLegacyHistoryReady,
      finalStorageNamespace,
      networkId,
      onKLineLoadError,
      tokenAddress,
    ],
  );
  const handleHistoryReady = useCallback(
    (data: ITradingViewHistoryReadyData) => {
      if (!data.firstDataRequest) {
        return;
      }

      const readyKey = buildKLineHistoryReadyKey({
        networkId: data.networkId || networkId,
        tokenAddress: data.tokenAddress || tokenAddress,
        symbol: data.symbol || chartSymbol,
        resolution: data.resolution,
      });
      if (readyKey === currentHistoryReadyKey) {
        if (data.status === 'failed') {
          setFirstHistoryReadyKey((currentReadyKey) =>
            currentReadyKey === readyKey ? null : currentReadyKey,
          );
          return;
        }
        clearMarketSymbolSyncRecoveryTimer();
        initialHistoryBootstrapSentIdentityRef.current = undefined;
        setFirstHistoryReadyKey(readyKey);
      }
    },
    [
      chartSymbol,
      clearMarketSymbolSyncRecoveryTimer,
      currentHistoryReadyKey,
      networkId,
      tokenAddress,
    ],
  );
  const handleFirstPaintReady = useCallback(
    (data: ITradingViewFirstPaintReadyData) => {
      const currentIdentityKey = buildMarketTradingViewIdentityKey({
        symbol: chartSymbol.trim().toLowerCase(),
        tokenAddress,
        networkId,
        decimal,
      });
      const firstPaintIdentityKey = buildMarketTradingViewIdentityKey({
        symbol: (data.symbol || chartSymbol).trim().toLowerCase(),
        tokenAddress: data.tokenAddress ?? tokenAddress,
        networkId: data.networkId || networkId,
        decimal,
      });
      const tracking = firstPaintTrackingRef.current;
      if (
        firstPaintIdentityKey !== currentIdentityKey ||
        tracking.requestIds.has(data.requestId) ||
        tracking.identity !== firstPaintMetricIdentity
      ) {
        return;
      }

      if (data.status !== 'failed') {
        successfulFirstPaintRef.current = {
          identity: firstPaintMetricIdentity,
          webViewLoadGeneration: webViewLoadGeneration.current,
        };
        clearMarketSymbolSyncRecoveryTimer();
        initialHistoryBootstrapSentIdentityRef.current = undefined;
      }
      tracking.requestIds.add(data.requestId);
      if (tracking.requestIds.size > 100) {
        const oldestRequestId = tracking.requestIds.values().next().value;
        if (typeof oldestRequestId === 'string') {
          tracking.requestIds.delete(oldestRequestId);
        }
      }
      if (!tracking.hasTracked) {
        tracking.hasTracked = true;
        defaultLogger.dex.tradingView.dexTVFirstPaint({
          durationMs: Math.max(0, Date.now() - tracking.startedAt),
          tvInterval: normalizeTradingViewKLineInterval(data.resolution),
          status: data.status,
          source: data.source,
          returnedCount: Math.max(0, Math.floor(data.returnedCount)),
          appPlatform: String(platformEnv.appPlatform ?? 'unknown'),
        });
      }
      onFirstPaintReady?.(data);
    },
    [
      chartSymbol,
      clearMarketSymbolSyncRecoveryTimer,
      decimal,
      firstPaintMetricIdentity,
      networkId,
      onFirstPaintReady,
      tokenAddress,
    ],
  );
  const handleKLinePeriodChange = useCallback(
    (data: ITradingViewKLinePeriodChangeData) => {
      onKLinePeriodChange?.({
        ...data,
        storageNamespace: finalStorageNamespace,
      });
    },
    [finalStorageNamespace, onKLinePeriodChange],
  );
  const handleIntervalConfigMessage = useCallback(
    (data: ITradingViewIntervalConfigData) => {
      const previousPeriod = normalizeTradingViewKLineInterval(
        currentKLineResolution.current,
      );
      handleIntervalConfigChange(data);
      if (isIntervalAckSupported === true && data.persist === true) {
        handleKLinePeriodChange({
          fromPeriod: previousPeriod,
          toPeriod: normalizeTradingViewKLineInterval(data.activeInterval),
        });
      }
    },
    [
      handleIntervalConfigChange,
      handleKLinePeriodChange,
      isIntervalAckSupported,
    ],
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
    isDataRequestEnabled,
    onTouchScroll,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    forceEmptyKLineData,
    emptyKLineDataOnError,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    onPrimaryKLineDataUnavailable,
    onPriceUpdate,
    onIntervalConfigChange: handleIntervalConfigMessage,
    onNativeChartControlsConfigChange: enableNativeChartControls
      ? handleNativeChartControlsConfigChange
      : undefined,
    onKLineDataReady: handleKLineDataReady,
    onKLineLoadError: handleKLineLoadError,
    onKLinePeriodChange:
      onKLinePeriodChange && isIntervalAckSupported === false
        ? handleKLinePeriodChange
        : undefined,
    onMarketSymbolSyncSupportChange: setIsMarketSymbolSyncSupported,
    onMarketAppKlineTransportSupportChange:
      setIsMarketAppKlineTransportSupported,
    onIntervalAckSupportChange: setIsIntervalAckSupported,
    onHistoryReadyAckSupportChange: setIsHistoryReadyAckSupported,
    onChartReady: handleChartReady,
    onKLineRequestStart: handleKLineRequestStart,
    resolveReadinessAckTarget,
    onHistoryReady: handleHistoryReady,
    onFirstPaintReady: handleFirstPaintReady,
    isKLineHistoryReady,
  });

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
  const staticAdditionalParams = useMemo(() => {
    return {
      type: 'market',
      storageNamespace: finalStorageNamespace,
      ...(initialResolutionForFrame
        ? { initialResolution: initialResolutionForFrame }
        : {}),
      initialHistoryBootstrap: '1',
      marketSymbolSync: '1',
      ...(enableNativeIntervalSelector ? { nativeIntervalSelector: '1' } : {}),
      ...(enableNativeChartControls ? { nativeChartControls: '1' } : {}),
      ...(useHyperLiquid ? { scene: 'market-hyperliquid' } : {}),
      ...(useHyperLiquid ? { marketKlineTransport: 'app-v2' } : {}),
    };
  }, [
    enableNativeChartControls,
    enableNativeIntervalSelector,
    finalStorageNamespace,
    initialResolutionForFrame,
    useHyperLiquid,
  ]);

  const { finalUrl: staticTradingViewUrl, timezone: tradingViewTimezone } =
    useTradingViewUrl({
      additionalParams: staticAdditionalParams,
      disabledFeatures,
    });
  const marketSymbolIdentityKey =
    buildMarketTradingViewIdentityKey(marketSymbolIdentity);
  const shouldForceReloadMarketSymbol =
    forceReloadMarketSymbolIdentityKey === marketSymbolIdentityKey;
  const {
    staticTradingViewUrl: iframeStaticTradingViewUrl,
    identity: iframeIdentity,
  } = useMarketTradingViewFrameIdentity({
    staticTradingViewUrl,
    identity: marketSymbolIdentity,
    symbolSyncSupport: shouldForceReloadMarketSymbol
      ? false
      : isMarketSymbolSyncSupported,
  });
  const iframeIdentityKey = buildMarketTradingViewIdentityKey(iframeIdentity);
  useEffect(() => {
    if (
      forceReloadMarketSymbolIdentityKey &&
      iframeIdentityKey === forceReloadMarketSymbolIdentityKey
    ) {
      setForceReloadMarketSymbolIdentityKey(undefined);
    }
  }, [forceReloadMarketSymbolIdentityKey, iframeIdentityKey]);
  const scheduleMarketSymbolSyncRecovery = useCallback(() => {
    clearMarketSymbolSyncRecoveryTimer();
    const successfulFirstPaint = successfulFirstPaintRef.current;
    if (
      !isVisibilityManagedExternally ||
      isKLineHistoryReadyRef.current ||
      isMarketSymbolSyncSupported !== true ||
      iframeIdentityKey === marketSymbolIdentityKey ||
      forceReloadMarketSymbolIdentityKey === marketSymbolIdentityKey ||
      (successfulFirstPaint?.identity === firstPaintMetricIdentity &&
        successfulFirstPaint.webViewLoadGeneration ===
          webViewLoadGeneration.current) ||
      initialHistoryBootstrapSentIdentityRef.current !==
        firstPaintMetricIdentity
    ) {
      return;
    }

    const scheduledDataRequestIdentity = firstPaintMetricIdentity;
    marketSymbolSyncRecoveryTimerRef.current = setTimeout(() => {
      marketSymbolSyncRecoveryTimerRef.current = undefined;
      const latestSuccessfulFirstPaint = successfulFirstPaintRef.current;
      if (
        isDataRequestEnabledRef.current &&
        !isKLineHistoryReadyRef.current &&
        currentDataRequestIdentityRef.current ===
          scheduledDataRequestIdentity &&
        !(
          latestSuccessfulFirstPaint?.identity ===
            scheduledDataRequestIdentity &&
          latestSuccessfulFirstPaint.webViewLoadGeneration ===
            webViewLoadGeneration.current
        )
      ) {
        setForceReloadMarketSymbolIdentityKey(marketSymbolIdentityKey);
      }
    }, MARKET_SYMBOL_SYNC_RECOVERY_TIMEOUT_MS);
  }, [
    clearMarketSymbolSyncRecoveryTimer,
    firstPaintMetricIdentity,
    forceReloadMarketSymbolIdentityKey,
    iframeIdentityKey,
    isMarketSymbolSyncSupported,
    isVisibilityManagedExternally,
    marketSymbolIdentityKey,
  ]);
  useEffect(() => {
    if (!isKLineHistoryReady) {
      scheduleMarketSymbolSyncRecovery();
    }
  }, [
    isKLineHistoryReady,
    scheduleMarketSymbolSyncRecovery,
    isMarketSymbolSyncSupported,
  ]);
  const tradingViewUrlWithParams = useMemo(
    () =>
      buildMarketTradingViewUrl({
        baseUrl: iframeStaticTradingViewUrl,
        identity: iframeIdentity,
      }),
    [iframeIdentity, iframeStaticTradingViewUrl],
  );

  useMarketSymbolSync({
    webRef,
    identity: marketSymbolIdentity,
    frameIdentity: iframeIdentity,
    documentGeneration: webViewLoadGeneration.current,
    enabled: isVisible && isMarketSymbolSyncSupported === true,
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
    !isKLineSourceLoading &&
    (!useHyperLiquid || isMarketAppKlineTransportSupported === true) &&
    !mockEmptyKLineEnabled &&
    !forceEmptyKLineData;
  const shouldUseWebSocketKLine =
    canUseAppKLineRealtime &&
    !useHyperLiquid &&
    effectiveDataSource === 'websocket';

  useTradingViewV2WebSocket({
    tokenAddress,
    networkId,
    webRef,
    enabled: shouldUseWebSocketKLine,
    chartType: activeKLineResolution,
    symbol: chartSymbol,
  });

  // App-served market candles use the same provider for history and realtime.
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

  useEffect(() => {
    marksTimeRange.current = null;
  }, [accountAddress, networkId, tokenAddress]);

  // Initial marks are loaded by the first history response. Swap refreshes are
  // enabled only after that response so they cannot compete with first paint.
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
        isRequestCurrent: () =>
          isDataRequestEnabledRef.current &&
          currentDataRequestIdentityRef.current === firstPaintMetricIdentity,
      });
    };

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
    firstPaintMetricIdentity,
    webRef,
    webViewLoadGeneration,
  ]);

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
      clearCapabilityHandshakeTimer();
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      clearMarketSymbolSyncRecoveryTimer();
      initialHistoryBootstrapSentIdentityRef.current = undefined;
      successfulFirstPaintRef.current = undefined;
      webViewLoadGeneration.current += 1;
      capabilityHandshakeSettledGenerationRef.current = null;
      firstPaintTrackingRef.current.startedAt = Date.now();
      firstPaintTrackingRef.current.hasTracked = false;
      firstPaintTrackingRef.current.requestIds.clear();
      readinessAckTargetsRef.current.clear();
      setIsMarketSymbolSyncSupported(undefined);
      setIsMarketAppKlineTransportSupported(undefined);
      setIsIntervalAckSupported(undefined);
      setIsHistoryReadyAckSupported(undefined);
      pendingLegacyHistoryReadyRef.current = null;
      notifiedLegacyHistoryReadyKeyRef.current = null;
      isKLineHistoryReadyRef.current = false;
      setFirstHistoryReadyKey(null);
      setIntervalConfig(null);
      setNativeChartControlsConfig(null);
      resetInteractionLocks();
      onLoadStart?.(event);
    },
    [
      clearCapabilityHandshakeTimer,
      clearMarketSymbolSyncRecoveryTimer,
      onLoadStart,
      resetInteractionLocks,
      webViewLoadGeneration,
    ],
  );

  const deliverInitialHistoryBootstrap = useCallback(
    (ref: IWebViewRef) => {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      clearMarketSymbolSyncRecoveryTimer();
      initialHistoryBootstrapSentIdentityRef.current = undefined;
      const requestTarget = captureTradingViewRequestTarget({
        webRef,
        webViewLoadGeneration,
        isRequestCurrent: () =>
          isDataRequestEnabledRef.current &&
          currentDataRequestIdentityRef.current === firstPaintMetricIdentity,
      });
      const identity = {
        symbol: chartSymbol,
        tokenAddress,
        networkId,
        decimal: decimal.toString(),
      };
      const bootstrapIdPrefix = [
        networkId,
        tokenAddress,
        bootstrapKLineResolution,
      ].join(':');
      const sendUnavailable = (reason: string) => {
        if (requestTarget.requestWebView !== ref) {
          return;
        }
        const bootstrapId = `${bootstrapIdPrefix}:unavailable`;
        registerReadinessAckTarget(bootstrapId);
        requestTarget.sendMessage({
          type: 'KLINE_BOOTSTRAP_UNAVAILABLE',
          payload: {
            protocolVersion: KLINE_BOOTSTRAP_PROTOCOL_VERSION,
            bootstrapId,
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
          onResult: (result, delivery) => {
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
            // First screen is a single viewport-complete package. Ignore late
            // upgrade deliveries so the chart never resets after first paint.
            if (delivery !== 'initial') {
              return;
            }
            const bootstrapId = [
              bootstrapIdPrefix,
              result.requestedTimeTo,
              delivery,
              result.coveredTimeFrom,
              result.points.length,
            ].join(':');
            registerReadinessAckTarget(bootstrapId);
            const bootstrapSent = requestTarget.sendMessage({
              type: 'KLINE_BOOTSTRAP',
              payload: {
                protocolVersion: KLINE_BOOTSTRAP_PROTOCOL_VERSION,
                bootstrapId,
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
            if (bootstrapSent) {
              initialHistoryBootstrapSentIdentityRef.current =
                firstPaintMetricIdentity;
              scheduleMarketSymbolSyncRecovery();
            }
          },
          onError: () => sendUnavailable('prefetch-failed'),
        });
      // Route restoration and direct links do not pass through the market-list
      // preload. Start the same deduplicated request here so the chart never
      // depends on an earlier navigation side effect to receive its bootstrap.
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
      clearMarketSymbolSyncRecoveryTimer,
      decimal,
      firstPaintMetricIdentity,
      forceEmptyKLineData,
      historyStartTime,
      kLineDataFallback,
      kLineProvider,
      kLineProviderSymbol,
      mockEmptyKLineEnabled,
      networkId,
      primaryKLineDataUnavailable,
      registerReadinessAckTarget,
      scheduleMarketSymbolSyncRecovery,
      tokenAddress,
      webRef,
      webViewLoadGeneration,
    ],
  );

  const deliverInitialHistoryBootstrapRef = useRef(
    deliverInitialHistoryBootstrap,
  );
  deliverInitialHistoryBootstrapRef.current = deliverInitialHistoryBootstrap;

  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      webRef.current = ref;
      if (ref && isDataRequestEnabledRef.current) {
        deliverInitialHistoryBootstrapRef.current(ref);
      }
    },
    [webRef],
  );

  const handleContentProcessDidTerminate = useCallback(
    (event: WebViewTerminatedEvent) => {
      webRef.current?.reload();
      onContentProcessDidTerminate?.(event);
    },
    [onContentProcessDidTerminate, webRef],
  );

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      const loadGeneration = webViewLoadGeneration.current;
      if (
        capabilityHandshakeSettledGenerationRef.current !== loadGeneration &&
        capabilityHandshakeTimerRef.current === undefined
      ) {
        capabilityHandshakeTimerRef.current = setTimeout(() => {
          capabilityHandshakeTimerRef.current = undefined;
          fallbackToLegacyCapabilities(loadGeneration);
        }, TRADINGVIEW_CAPABILITY_HANDSHAKE_TIMEOUT_MS);
      }
      if (isVisible && webRef.current) {
        deliverInitialHistoryBootstrap(webRef.current);
      }
      onLoadEnd?.(event);
    },
    [
      deliverInitialHistoryBootstrap,
      fallbackToLegacyCapabilities,
      isVisible,
      onLoadEnd,
      webRef,
      webViewLoadGeneration,
    ],
  );

  useEffect(() => {
    if (!isVisible) {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      clearMarketSymbolSyncRecoveryTimer();
      initialHistoryBootstrapSentIdentityRef.current = undefined;
      return;
    }
    if (webRef.current) {
      deliverInitialHistoryBootstrap(webRef.current);
    }
  }, [
    clearMarketSymbolSyncRecoveryTimer,
    deliverInitialHistoryBootstrap,
    isVisible,
    webRef,
  ]);

  useEffect(
    () => () => {
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      cancelInitialHistoryBootstrapSubscriptionRef.current = undefined;
      clearMarketSymbolSyncRecoveryTimer();
      initialHistoryBootstrapSentIdentityRef.current = undefined;
    },
    [clearMarketSymbolSyncRecoveryTimer],
  );

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
        maxSubIndicatorCount={maxNativeSubIndicatorCount}
        onIndicatorSelect={handleNativeIndicatorSelect}
        onControlInteraction={handleNativeControlInteraction}
      />
    );
  }, [
    enableNativeChartControls,
    handleNativeControlInteraction,
    handleNativeIndicatorSelect,
    maxNativeSubIndicatorCount,
    nativeChartControlsConfig,
    nativeIndicatorState,
    showNativeIndicatorQuickBar,
  ]);

  useEffect(() => {
    onNativeIndicatorQuickBarChange?.(nativeIndicatorQuickBar);
  }, [nativeIndicatorQuickBar, onNativeIndicatorQuickBarChange]);

  useEffect(() => {
    return () => {
      clearCapabilityHandshakeTimer();
      cancelInitialHistoryBootstrapSubscriptionRef.current?.();
      resetInteractionLocks();
    };
  }, [clearCapabilityHandshakeTimer, resetInteractionLocks]);

  useEffect(() => {
    if (!onNativeIndicatorQuickBarChange) {
      return undefined;
    }

    return () => {
      onNativeIndicatorQuickBarChange(null);
    };
  }, [onNativeIndicatorQuickBarChange]);

  const handleMockEmptyKLineBadgePress = useCallback(() => {
    setMockEmptyKLineBadgePositionIndex(
      (positionIndex) =>
        (positionIndex + 1) % MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES.length,
    );
  }, []);

  const webView = useMemo(
    () => (
      <WebView
        key={`${theme}:${tradingViewUrlWithParams}`}
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
        onWebViewRef={handleWebViewRef}
        allowsBackForwardNavigationGestures={false}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
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
      handleLoadStart,
      handleLoadEnd,
      handleContentProcessDidTerminate,
      handleWebViewRef,
      onShouldStartLoadWithRequest,
      theme,
      tradingViewUrlWithParams,
      tradingViewWebViewStyleProps,
    ],
  );

  return (
    <Stack flex={1} {...stackStyle}>
      {enableNativeIntervalSelector ? (
        <TradingViewNativeChartControls
          intervalConfig={intervalConfig}
          nativeChartControlsConfig={nativeChartControlsConfig}
          nativeIndicatorState={nativeIndicatorState}
          maxSubIndicatorCount={maxNativeSubIndicatorCount}
          isControlsReady={isNativeChartControlsReady}
          chartTypeControlMode={nativeChartTypeControlMode}
          indicatorControlMode={nativeIndicatorControlMode}
          intervalControlMode={nativeIntervalControlMode}
          priceMarketCapControlMode={nativePriceMarketCapControlMode}
          layoutMode={nativeControlsLayoutMode}
          chartTimezone={tradingViewTimezone}
          isFullscreen={isNativeChartFullscreen}
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
        {/* Source discovery controls the datafeed, but must not delay native
            WebView construction for the common OneKey source path. */}
        {platformEnv.isNative || !isKLineSourceLoading ? (
          webView
        ) : (
          <Stack flex={1} bg="$bgApp" />
        )}

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
