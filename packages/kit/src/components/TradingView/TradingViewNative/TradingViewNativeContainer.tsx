import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useSwapTradingViewChartSettingsPersistAtom,
  useSwapTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import { useTradingViewSettingsThemeColors } from '../TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';
import {
  canToggleTradingViewNativeIndicatorOn,
  getAppNativeIndicators,
  getIndicatorSections,
} from '../TradingViewChartControls/indicatorSelector/indicatorUtils';
import {
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
  TradingViewIndicatorQuickBar,
} from '../TradingViewChartControls/indicatorSelector/NativeIndicatorQuickBar';
import { resolveTradingViewNativeIndicatorQuickBarState } from '../TradingViewChartControls/indicatorSelector/nativeIndicatorQuickBarState';
import { TradingViewChartLoadingMask } from '../TradingViewChartLoadingMask';

import {
  TRADING_VIEW_NATIVE_COMPACT_PRICE_AXIS_TICK_COUNT,
  TRADING_VIEW_NATIVE_COMPACT_TIME_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_COMPACT_TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from './chartConstants';
import { normalizeTradingViewNativeChartSettings } from './chartSettingsAdapter';
import {
  emitTradingViewNativeDebugEvent,
  getTradingViewNativeDebugErrorMessage,
} from './data/tradingViewNativeDebugLogger';
import {
  buildTradingViewNativeGoToDateTimeRange,
  getTradingViewNativeKLineInterval,
  getTradingViewNativeKLineIntervalForTimeRange,
} from './data/tradingViewNativeIntervals';
import { useTradingViewNativeAccountMarks } from './data/useTradingViewNativeAccountMarks';
import { useTradingViewNativeKLine } from './data/useTradingViewNativeKLine';
import {
  getTradingViewNativeActiveMainIndicators,
  getTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeMainIndicatorSettings,
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
  reconcileTradingViewNativeIndicatorActiveState,
  updateTradingViewNativeIndicatorActiveState,
} from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { mergeMobileIndicatorSettings } from './mobileIndicatorSettingsUtils';
import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';
import { TradingViewNativeChartSettingsButton } from './TradingViewNativeChartSettingsButton';
import { TradingViewNativeFullscreenButton } from './TradingViewNativeFullscreenButton';
import { TradingViewNativeMultiChart } from './TradingViewNativeMultiChart';
import { TradingViewNativePresentation } from './TradingViewNativePresentation';
import { useTradingViewNativeChartComponents } from './useTradingViewNativeChartComponents';
import { useTradingViewPanelSettings } from './useTradingViewPanelSettings';
import {
  type ITradingViewNativeAnyIndicator,
  type ITradingViewNativeSubIndicator,
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  buildTradingViewNativeIndicatorSeries,
} from './utils/chartIndicators';
import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators/indicatorCatalog';
import { getTradingViewNativeCurrentPriceLabel } from './utils/chartLayout';
import {
  resolveTradingViewNativeChartThemeColors,
  resolveTradingViewNativeMainIndicatorThemeColors,
  resolveTradingViewNativeSubIndicatorThemeColors,
} from './utils/chartThemeColors';
import {
  getTradingViewNativePrimarySeriesPoints,
  resolveTradingViewNativeChartType,
} from './utils/chartType';
import {
  buildTradingViewNativeSubIndicatorRenderPanes,
  calculateTradingViewNativeSubIndicatorsWithCache,
  createTradingViewNativeSubIndicatorCalculationCache,
  resolveTradingViewNativeSubIndicatorInstance,
} from './utils/subIndicatorRender';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';
import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';
import type {
  ITradingViewNativeChartType,
  ITradingViewNativeDataState,
  ITradingViewNativeProps,
} from './types';
import type { ITradingViewNativeViewportTarget } from './utils/chartViewport';
import type { ITradingViewNativeSubIndicatorInstanceConfig } from './utils/subIndicatorRender/types';
import type { ICalendarPanelSubmitPayload } from '../TradingViewChartControls/calendarControls/CalendarPanelPopover';
import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeIndicatorSelection,
} from '../TradingViewChartControls/types';
import type { LayoutChangeEvent } from 'react-native';

export function updateTradingViewNativeSubIndicatorInstances(
  currentInstances: ITradingViewNativeSubIndicatorInstanceConfig[],
  indicator: ITradingViewNativeSubIndicator,
  desiredActive: boolean,
  maxSelectableSubIndicatorCount?: number,
): ITradingViewNativeSubIndicatorInstanceConfig[] {
  const existingIndex = currentInstances.findIndex(
    (instance) => instance.indicator === indicator,
  );
  const existingInstance =
    existingIndex >= 0 ? currentInstances[existingIndex] : undefined;
  if (existingInstance) {
    if ((existingInstance.isVisible !== false) === desiredActive) {
      return currentInstances;
    }

    if (!desiredActive) {
      const nextInstances = [...currentInstances];
      nextInstances[existingIndex] = {
        ...existingInstance,
        isVisible: false,
      };
      return nextInstances;
    }
  } else if (!desiredActive) {
    return currentInstances;
  }

  const normalizedMaxSelectableSubIndicatorCount =
    typeof maxSelectableSubIndicatorCount === 'number' &&
    Number.isFinite(maxSelectableSubIndicatorCount)
      ? Math.max(0, Math.floor(maxSelectableSubIndicatorCount))
      : undefined;
  const visibleInstanceCount = currentInstances.reduce(
    (count, instance) => (instance.isVisible !== false ? count + 1 : count),
    0,
  );
  if (
    normalizedMaxSelectableSubIndicatorCount !== undefined &&
    visibleInstanceCount >= normalizedMaxSelectableSubIndicatorCount
  ) {
    return currentInstances;
  }

  if (existingInstance) {
    const nextInstances = [...currentInstances];
    nextInstances[existingIndex] = {
      ...existingInstance,
      isVisible: true,
    };
    return nextInstances;
  }

  const nextInstances = [
    ...currentInstances,
    { id: indicator, indicator, isVisible: true },
  ];
  nextInstances.sort(
    (left, right) =>
      TRADING_VIEW_NATIVE_SUB_INDICATORS.indexOf(left.indicator) -
      TRADING_VIEW_NATIVE_SUB_INDICATORS.indexOf(right.indicator),
  );
  return nextInstances;
}

function getDataStateDebugLevel(status: ITradingViewNativeDataState['status']) {
  if (status === 'error') {
    return 'error' as const;
  }
  if (status === 'stale' || status === 'reconnecting') {
    return 'warning' as const;
  }
  return 'info' as const;
}

type ITradingViewNativeContentProps = ITradingViewNativeProps & {
  chartSettingsState: ReturnType<
    typeof useMarketTradingViewChartSettingsPersistAtom
  >;
  indicatorSettingsState: ReturnType<
    typeof useMarketTradingViewIndicatorSettingsPersistAtom
  >;
};

const TradingViewNativeContent = memo(
  ({
    testID,
    source,
    storageNamespace,
    panelId,
    isPresentationManaged,
    onPresentationContentChange,
    chartSettingsState,
    indicatorSettingsState,
    forcedChartType,
    chartComponents,
    accountMarksContext,
    previousClose,
    enablePreviousClose = false,
    enableNativeChartSettings,
    enableDrawings = false,
    nativeChartSettingsInToolbar = false,
    initialRightOffset,
    nativeChartDisplayMode,
    maxSelectableSubIndicatorCount,
    nativeControlsLayoutMode,
    nativeChartWorkspaceControls,
    nativeControlsFlushHorizontalInset,
    showNativeChartCloseControl,
    showNativeIndicatorQuickBar = false,
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
    isChartSwitchDisabled,
    onChartSwitch,
    onDataStateChange,
    onIntervalChange,
    onNativeChartClose,
    onNativeSubIndicatorCountChange,
    onNativeIndicatorQuickBarChange,
    onNativeChartFullscreenChange,
    onPriceUpdate,
  }: ITradingViewNativeContentProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const themeColors = useTradingViewSettingsThemeColors();
    const [storedChartSettings, setStoredChartSettings] = chartSettingsState;
    const [indicatorSettings, setIndicatorSettings] = indicatorSettingsState;
    const normalizedChartSettings = useMemo(
      () => normalizeTradingViewNativeChartSettings(storedChartSettings),
      [storedChartSettings],
    );
    const chartSettings = useMemo(
      () =>
        resolveTradingViewNativeChartThemeColors(
          normalizedChartSettings,
          themeColors,
        ),
      [normalizedChartSettings, themeColors],
    );
    const onPriceUpdateRef = useRef(onPriceUpdate);
    const realtimePointRef = useRef<{ c: number; t: number } | undefined>(
      undefined,
    );
    const pendingCalendarViewportTargetRef = useRef<{
      dataProviderKey: string;
      interval: ITradingViewNativeChartInterval;
      target: ITradingViewNativeViewportTarget;
    } | null>(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [chartAreaWidth, setChartAreaWidth] = useState(0);
    const [chartHeight, setChartHeight] = useState(0);
    const [subIndicatorCalculationCache] = useState(() =>
      createTradingViewNativeSubIndicatorCalculationCache(),
    );
    const normalizedIndicatorSettings = useMemo(
      () => normalizeTradingViewNativeIndicatorSettings(indicatorSettings),
      [indicatorSettings],
    );
    const indicatorSettingsValue = useMemo(
      () =>
        localizeTradingViewNativeIndicatorSettingsValue(
          getTradingViewNativeIndicatorSettingsValue(
            normalizedIndicatorSettings,
          ),
          intl,
        ),
      [intl, normalizedIndicatorSettings],
    );
    const mainIndicatorSettingsSnapshot = useMemo(
      () => ({
        schemaVersion: normalizedIndicatorSettings.schemaVersion,
        mainIndicators: normalizedIndicatorSettings.mainIndicators,
        subIndicators: [],
      }),
      [
        normalizedIndicatorSettings.mainIndicators,
        normalizedIndicatorSettings.schemaVersion,
      ],
    );
    const subIndicatorSettingsSnapshot = useMemo(
      () => ({
        schemaVersion: normalizedIndicatorSettings.schemaVersion,
        mainIndicators: [],
        subIndicators: normalizedIndicatorSettings.subIndicators,
      }),
      [
        normalizedIndicatorSettings.schemaVersion,
        normalizedIndicatorSettings.subIndicators,
      ],
    );
    const activeMainIndicatorValues = useMemo(
      () =>
        getTradingViewNativeActiveMainIndicators(mainIndicatorSettingsSnapshot),
      [mainIndicatorSettingsSnapshot],
    );
    const unresolvedMainIndicatorSettings = useMemo(
      () =>
        getTradingViewNativeMainIndicatorSettings(
          mainIndicatorSettingsSnapshot,
        ),
      [mainIndicatorSettingsSnapshot],
    );
    const mainIndicatorSettings = useMemo(
      () =>
        resolveTradingViewNativeMainIndicatorThemeColors(
          unresolvedMainIndicatorSettings,
          themeColors,
        ),
      [themeColors, unresolvedMainIndicatorSettings],
    );
    const mainIndicatorSettingsKey = useMemo(
      () => stableStringify(mainIndicatorSettings),
      [mainIndicatorSettings],
    );
    const unresolvedSubIndicatorInstances = useMemo(
      () =>
        getTradingViewNativeSubIndicatorInstances(subIndicatorSettingsSnapshot),
      [subIndicatorSettingsSnapshot],
    );
    const subIndicatorInstances = useMemo(
      () =>
        resolveTradingViewNativeSubIndicatorThemeColors(
          unresolvedSubIndicatorInstances,
          themeColors,
        ),
      [themeColors, unresolvedSubIndicatorInstances],
    );
    const activeIndicatorValues = useMemo(() => {
      const values = new Set<string>(activeMainIndicatorValues);
      subIndicatorInstances.forEach((instance) => {
        if (instance.isVisible !== false) {
          values.add(instance.indicator);
        }
      });
      return values;
    }, [activeMainIndicatorValues, subIndicatorInstances]);
    const { mainIndicators, subIndicators } = useMemo(
      () => getIndicatorSections(getAppNativeIndicators(activeIndicatorValues)),
      [activeIndicatorValues],
    );
    const canToggleIndicatorOn = useCallback(
      (indicatorValue: string) =>
        canToggleTradingViewNativeIndicatorOn({
          indicatorValue,
          activeIndicatorValues,
          maxSelectableSubIndicatorCount,
        }),
      [activeIndicatorValues, maxSelectableSubIndicatorCount],
    );
    useLayoutEffect(() => {
      onPriceUpdateRef.current = onPriceUpdate;
    }, [onPriceUpdate]);
    const handleRealtimePoint = useCallback(
      (point: { c: number; t: number }) => {
        realtimePointRef.current = point;
        onPriceUpdateRef.current?.({
          price: point.c,
          receivedAt: Date.now(),
          source: 'realtime',
          timestamp: point.t,
        });
      },
      [],
    );
    const {
      calendarAvailableTimeRange,
      candleIntervalSeconds,
      chartType: automaticChartType,
      chartPictureVersion,
      dataProviderKey,
      dataState,
      getVisibleTimeRange,
      points,
      intervalConfig,
      isSwitchingInterval,
      handleHistoryBoundaryPrefetch,
      handleIntervalChange,
      handleRetry,
      handleViewportTargetChange,
      handleViewportRequestApplied,
      handleVisiblePointRangeChange,
      viewportRequest,
    } = useTradingViewNativeKLine({
      panelId,
      onRealtimePoint: handleRealtimePoint,
      source,
      storageNamespace,
    });
    const chartType = useMemo(
      () =>
        resolveTradingViewNativeChartType({
          automaticChartType,
          preference: normalizedChartSettings.chartType,
        }),
      [automaticChartType, normalizedChartSettings.chartType],
    );
    const primarySeriesPoints = useMemo(
      () => getTradingViewNativePrimarySeriesPoints({ chartType, points }),
      [chartType, points],
    );
    const isCompactDisplayMode = nativeChartDisplayMode === 'compact';
    const timeAxisHeight = isCompactDisplayMode
      ? TRADING_VIEW_NATIVE_COMPACT_TIME_AXIS_HEIGHT
      : TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
    const indicatorSeries = useMemo(
      () =>
        isCompactDisplayMode
          ? []
          : buildTradingViewNativeIndicatorSeries({
              activeIndicatorValues: activeMainIndicatorValues,
              indicatorSettings: mainIndicatorSettings,
              points: primarySeriesPoints,
            }),
      [
        activeMainIndicatorValues,
        isCompactDisplayMode,
        mainIndicatorSettings,
        primarySeriesPoints,
      ],
    );
    const visibleSubIndicatorInstances = useMemo(
      () =>
        isCompactDisplayMode
          ? []
          : subIndicatorInstances
              .filter((instance) => instance.isVisible !== false)
              .map(resolveTradingViewNativeSubIndicatorInstance),
      [isCompactDisplayMode, subIndicatorInstances],
    );
    const visibleSubIndicatorCount = visibleSubIndicatorInstances.length;
    const subIndicatorCalculationEntries = useMemo(
      () =>
        calculateTradingViewNativeSubIndicatorsWithCache({
          cache: subIndicatorCalculationCache,
          instances: visibleSubIndicatorInstances,
          points: primarySeriesPoints,
        }),
      [
        primarySeriesPoints,
        subIndicatorCalculationCache,
        visibleSubIndicatorInstances,
      ],
    );
    const subIndicatorPanes = useMemo(
      () =>
        buildTradingViewNativeSubIndicatorRenderPanes(
          subIndicatorCalculationEntries,
        ),
      [subIndicatorCalculationEntries],
    );
    const candleLabels = useMemo(
      () => ({
        close: intl.formatMessage({
          id: ETranslations.market_close_abbr,
        }),
        high: intl.formatMessage({
          id: ETranslations.market_high_abbr,
        }),
        low: intl.formatMessage({
          id: ETranslations.market_low_abbr,
        }),
        open: intl.formatMessage({
          id: ETranslations.market_open_abbr,
        }),
      }),
      [intl],
    );
    const latestPoint = points[points.length - 1];
    const latestPrice = latestPoint?.c;
    const latestPriceTimestamp = latestPoint?.t;
    const sourceCoin = source.kind === 'hyperliquid' ? source.coin : undefined;
    const sourceEnvironment =
      source.kind === 'hyperliquid' ? source.environment : undefined;
    const sourceNetworkId =
      source.kind === 'market' ? source.networkId : undefined;
    const sourceRealtime =
      source.kind === 'market' ? source.realtime : undefined;
    const sourceSymbol = source.kind === 'market' ? source.symbol : undefined;
    const sourceTokenAddress =
      source.kind === 'market' ? source.tokenAddress : undefined;
    const currentPriceLabel = useMemo(
      () => getTradingViewNativeCurrentPriceLabel(primarySeriesPoints),
      [primarySeriesPoints],
    );
    const accountMarks = useTradingViewNativeAccountMarks({
      context: accountMarksContext,
      from: points[0]?.t,
      to: latestPoint ? latestPoint.t + candleIntervalSeconds : undefined,
    });
    const chartComponentsWithAccountMarks = useMemo(
      () => [...(chartComponents ?? []), ...accountMarks],
      [accountMarks, chartComponents],
    );
    const chartComponentRenderNodes = useTradingViewNativeChartComponents({
      chartComponents: chartComponentsWithAccountMarks,
      previousClose,
      referenceLineColor:
        themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.referenceLine],
      // Only opted-in charts draw the line, and the hook itself needs a real
      // close, so no live price can end up labelled "Prev close".
      showPreviousClose:
        enablePreviousClose && normalizedChartSettings.options.previousClose,
    });

    useEffect(() => {
      emitTradingViewNativeDebugEvent({ name: 'chart.mount' });
      return () => {
        emitTradingViewNativeDebugEvent({ name: 'chart.unmount' });
      };
    }, []);

    useEffect(() => {
      emitTradingViewNativeDebugEvent({
        details: {
          coin: sourceCoin,
          environment: sourceEnvironment,
          kind: source.kind,
          networkId: sourceNetworkId,
          providerKey: dataProviderKey,
          realtime: sourceRealtime,
          symbol: sourceSymbol,
          tokenAddress: sourceTokenAddress,
        },
        name: 'source.selected',
      });
    }, [
      dataProviderKey,
      source.kind,
      sourceCoin,
      sourceEnvironment,
      sourceNetworkId,
      sourceRealtime,
      sourceSymbol,
      sourceTokenAddress,
    ]);

    useEffect(() => {
      emitTradingViewNativeDebugEvent({
        details: {
          error: dataState.error
            ? getTradingViewNativeDebugErrorMessage(dataState.error)
            : undefined,
          interval: intervalConfig.activeInterval,
          lastUpdatedAt: dataState.lastUpdatedAt,
          points: points.length,
          providerKey: dataProviderKey,
          status: dataState.status,
        },
        level: getDataStateDebugLevel(dataState.status),
        name: 'data.state',
      });
    }, [
      dataProviderKey,
      dataState.error,
      dataState.lastUpdatedAt,
      dataState.status,
      intervalConfig.activeInterval,
      points.length,
    ]);

    useEffect(() => {
      realtimePointRef.current = undefined;
    }, [candleIntervalSeconds, dataProviderKey]);

    useEffect(() => {
      if (latestPrice === undefined || latestPriceTimestamp === undefined) {
        return;
      }

      const realtimePoint = realtimePointRef.current;
      if (
        realtimePoint?.c === latestPrice &&
        realtimePoint.t === latestPriceTimestamp
      ) {
        return;
      }
      onPriceUpdate?.({
        price: latestPrice,
        receivedAt: Date.now(),
        source: 'history',
        timestamp: latestPriceTimestamp,
      });
    }, [latestPrice, latestPriceTimestamp, onPriceUpdate]);

    const changeChartInterval = useCallback(
      (
        interval: string,
        options?: {
          skipNextHistoryRequest?: boolean;
        },
      ) => {
        const nextInterval = getTradingViewNativeKLineInterval(interval);
        const fromInterval = intervalConfig.activeInterval;
        if (!nextInterval || nextInterval.value === fromInterval) {
          emitTradingViewNativeDebugEvent({
            details: {
              fromInterval,
              requestedInterval: interval,
              resolvedInterval: nextInterval?.value,
            },
            level: 'warning',
            name: 'interval.change.ignored',
          });
          return;
        }

        emitTradingViewNativeDebugEvent({
          details: {
            fromInterval,
            skipNextHistoryRequest: Boolean(options?.skipNextHistoryRequest),
            toInterval: nextInterval.value,
          },
          name: 'interval.change.requested',
        });
        handleIntervalChange(nextInterval.value, options);
        onIntervalChange?.({
          fromInterval,
          toInterval: nextInterval.value,
        });
      },
      [handleIntervalChange, intervalConfig.activeInterval, onIntervalChange],
    );

    const handleChartIntervalChange = useCallback(
      (interval: string) => {
        pendingCalendarViewportTargetRef.current = null;
        changeChartInterval(interval);
      },
      [changeChartInterval],
    );

    const handleChartTypeChange = useCallback(
      (nextChartType: ITradingViewNativeChartType) => {
        void setStoredChartSettings((currentSettings) => {
          const normalizedCurrentSettings =
            normalizeTradingViewNativeChartSettings(currentSettings);
          if (normalizedCurrentSettings.chartType === nextChartType) {
            return currentSettings;
          }
          return {
            ...normalizedCurrentSettings,
            chartType: nextChartType,
          };
        });
      },
      [setStoredChartSettings],
    );

    const handleIndicatorChange = useCallback(
      (indicator: ITradingViewNativeAnyIndicator, desiredActive: boolean) => {
        void setIndicatorSettings((currentSettings) =>
          updateTradingViewNativeIndicatorActiveState({
            active: desiredActive,
            indicator,
            maxSelectableSubIndicatorCount,
            settings: currentSettings,
          }),
        );
      },
      [maxSelectableSubIndicatorCount, setIndicatorSettings],
    );
    const handleQuickBarIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        if (isTradingViewNativeAnyIndicator(indicator.value)) {
          handleIndicatorChange(
            indicator.value,
            !activeIndicatorValues.has(indicator.value),
          );
        }
      },
      [activeIndicatorValues, handleIndicatorChange],
    );
    const handleIndicatorSelectionConfirm = useCallback(
      ({
        activeIndicatorValues: selectedIndicatorValues,
        replaceMainIndicators,
        replaceSubIndicators,
      }: ITradingViewNativeIndicatorSelection) => {
        return setIndicatorSettings((currentSettings) =>
          reconcileTradingViewNativeIndicatorActiveState({
            activeIndicatorValues: selectedIndicatorValues,
            replaceMainIndicators,
            replaceSubIndicators,
            settings: currentSettings,
          }),
        );
      },
      [setIndicatorSettings],
    );
    const handleExitFullscreen = useCallback(() => {
      if (isNativeChartFullscreen) {
        onNativeChartFullscreenChange?.(false);
      }
    }, [isNativeChartFullscreen, onNativeChartFullscreenChange]);
    const handleIndicatorSettingsPress = useCallback(
      (indicator?: ITradingViewNativeAnyIndicator) => {
        if (nativeControlsLayoutMode !== 'desktop' && !indicator) {
          handleExitFullscreen();
          navigation.pushModal(EModalRoutes.MarketModal, {
            screen: EModalMarketRoutes.MarketIndicatorSettings,
            params: {
              storageNamespace: storageNamespace ?? 'market',
              ...(panelId ? { panelId } : {}),
            },
          });
          return;
        }
        showTradingViewNativeIndicatorSettingsDialog({
          displayMode:
            nativeControlsLayoutMode === 'desktop' ? 'full' : 'focused',
          initialIndicatorId: indicator,
          intl,
          onConfirm: (nextValue) =>
            nativeControlsLayoutMode !== 'desktop' && indicator
              ? setIndicatorSettings((current) =>
                  mergeMobileIndicatorSettings(current, nextValue, indicator),
                )
              : setIndicatorSettings(nextValue),
          value: indicatorSettingsValue,
        });
      },
      [
        handleExitFullscreen,
        indicatorSettingsValue,
        intl,
        nativeControlsLayoutMode,
        navigation,
        setIndicatorSettings,
        storageNamespace,
        panelId,
      ],
    );

    const handleCalendarPanelSubmit = useCallback(
      (payload: ICalendarPanelSubmitPayload) => {
        const target: ITradingViewNativeViewportTarget =
          payload.panel === 'goToDate'
            ? {
                kind: 'timeRange',
                ...buildTradingViewNativeGoToDateTimeRange({
                  timestamp: payload.timestamp,
                  visibleRange: getVisibleTimeRange(),
                }),
              }
            : {
                kind: 'timeRange',
                from: payload.from,
                to: payload.to,
              };
        if (target.kind === 'timeRange') {
          const targetInterval = getTradingViewNativeKLineIntervalForTimeRange({
            chartWidth,
            currentInterval: intervalConfig.activeInterval,
            intervals: intervalConfig.intervals,
            from: target.from,
            to: target.to,
          });
          if (targetInterval.value !== intervalConfig.activeInterval) {
            pendingCalendarViewportTargetRef.current = {
              dataProviderKey,
              interval: targetInterval.value,
              target,
            };
            changeChartInterval(targetInterval.value, {
              skipNextHistoryRequest: true,
            });
            return;
          }
        }

        pendingCalendarViewportTargetRef.current = null;
        void handleViewportTargetChange(target);
      },
      [
        changeChartInterval,
        chartWidth,
        dataProviderKey,
        getVisibleTimeRange,
        handleViewportTargetChange,
        intervalConfig.activeInterval,
        intervalConfig.intervals,
      ],
    );

    useEffect(() => {
      const pendingTarget = pendingCalendarViewportTargetRef.current;
      if (
        !pendingTarget ||
        pendingTarget.dataProviderKey !== dataProviderKey ||
        pendingTarget.interval !== intervalConfig.activeInterval
      ) {
        return;
      }

      pendingCalendarViewportTargetRef.current = null;
      void handleViewportTargetChange(pendingTarget.target);
    }, [
      dataProviderKey,
      handleViewportTargetChange,
      intervalConfig.activeInterval,
    ]);

    useEffect(() => {
      pendingCalendarViewportTargetRef.current = null;
    }, [dataProviderKey]);

    useEffect(() => {
      onDataStateChange?.(dataState);
    }, [dataState, onDataStateChange]);

    useEffect(() => {
      onNativeSubIndicatorCountChange?.(visibleSubIndicatorCount);
    }, [onNativeSubIndicatorCountChange, visibleSubIndicatorCount]);

    const isMobileControlsLayout = nativeControlsLayoutMode !== 'desktop';
    const nativeIndicatorQuickBar = useMemo(
      () =>
        showNativeIndicatorQuickBar &&
        isMobileControlsLayout &&
        !isCompactDisplayMode ? (
          <TradingViewIndicatorQuickBar
            activeIndicatorValues={activeIndicatorValues}
            mainIndicators={mainIndicators}
            subIndicators={subIndicators}
            canToggleIndicatorOn={canToggleIndicatorOn}
            onIndicatorPress={handleQuickBarIndicatorPress}
            settingsControl={
              <IconButton
                testID="trading-view-native-indicator-settings-trigger"
                size="small"
                variant="tertiary"
                icon="ChartTrending2Outline"
                iconSize="$5"
                width="$10"
                height={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.market_indicators,
                })}
                onPress={() => handleIndicatorSettingsPress()}
              />
            }
          />
        ) : null,
      [
        activeIndicatorValues,
        canToggleIndicatorOn,
        handleIndicatorSettingsPress,
        handleQuickBarIndicatorPress,
        intl,
        isCompactDisplayMode,
        isMobileControlsLayout,
        mainIndicators,
        showNativeIndicatorQuickBar,
        subIndicators,
      ],
    );
    useEffect(() => {
      onNativeIndicatorQuickBarChange?.(
        resolveTradingViewNativeIndicatorQuickBarState({
          isAvailabilityResolved: true,
          quickBar: isNativeChartFullscreen ? null : nativeIndicatorQuickBar,
        }),
      );
    }, [
      isNativeChartFullscreen,
      nativeIndicatorQuickBar,
      onNativeIndicatorQuickBarChange,
    ]);
    useEffect(
      () => () => {
        onNativeIndicatorQuickBarChange?.({
          status: 'loading',
          quickBar: null,
        });
      },
      [onNativeIndicatorQuickBarChange],
    );
    const handleChartAreaLayout = useCallback((event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      const nextChartHeight = Math.round(height);
      const nextChartAreaWidth = Math.round(width);
      if (nextChartHeight > 0) {
        setChartHeight((currentChartHeight) =>
          currentChartHeight === nextChartHeight
            ? currentChartHeight
            : nextChartHeight,
        );
      }
      if (nextChartAreaWidth > 0) {
        setChartAreaWidth((currentChartAreaWidth) =>
          currentChartAreaWidth === nextChartAreaWidth
            ? currentChartAreaWidth
            : nextChartAreaWidth,
        );
      }
    }, []);
    const handleMobileFullscreenToggle = useCallback(() => {
      onNativeChartFullscreenChange?.(!isNativeChartFullscreen);
    }, [isNativeChartFullscreen, onNativeChartFullscreenChange]);
    const showChartLoadingMask =
      points.length === 0 && dataState.status !== 'error';
    const priceAxisWidth =
      chartWidth > 0 ? Math.max(chartAreaWidth - chartWidth, 0) : 0;
    const mobileSettingsControl = useMemo(
      () =>
        isMobileControlsLayout &&
        enableNativeChartSettings &&
        nativeChartSettingsInToolbar ? (
          <TradingViewNativeChartSettingsButton
            panelId={panelId}
            placement="toolbar"
            priceAxisWidth={priceAxisWidth}
            enablePreviousClose={enablePreviousClose}
            isChartSwitchDisabled={isChartSwitchDisabled}
            onChartSwitch={onChartSwitch}
            onBeforeOpenSettings={handleExitFullscreen}
          />
        ) : undefined,
      [
        enableNativeChartSettings,
        enablePreviousClose,
        handleExitFullscreen,
        isChartSwitchDisabled,
        isMobileControlsLayout,
        nativeChartSettingsInToolbar,
        onChartSwitch,
        panelId,
        priceAxisWidth,
      ],
    );
    const chartRuntimeRef = useMemo<ITradingViewNativeChartProps['runtimeRef']>(
      () => ({ current: null }),
      // A new symbol or interval owns a fresh viewport; presentation changes reuse it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [dataProviderKey, candleIntervalSeconds],
    );

    const chartContent = (
      <TradingViewNativePresentation
        isFullscreen={Boolean(
          isNativeChartFullscreen && !isPresentationManaged,
        )}
      >
        <Stack flex={1} w="100%" h="100%" bg="$transparent">
          <TradingViewNativeChartControlsContainer
            panelId={panelId}
            activeChartType={chartType}
            calendarAvailableTimeRange={calendarAvailableTimeRange}
            compactMobileLayout={isCompactDisplayMode}
            enableNativeChartSettings={enableNativeChartSettings}
            mobileSettingsControl={mobileSettingsControl}
            enablePreviousClose={enablePreviousClose}
            intervalConfig={intervalConfig}
            activeIndicatorValues={activeIndicatorValues}
            maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
            layoutMode={nativeControlsLayoutMode}
            workspaceControls={nativeChartWorkspaceControls}
            flushDesktopControls={nativeControlsFlushHorizontalInset}
            showChartCloseControl={showNativeChartCloseControl}
            isFullscreen={isNativeChartFullscreen}
            fullscreenHeader={nativeChartFullscreenHeader}
            isChartSwitchDisabled={isChartSwitchDisabled}
            onChartSwitch={onChartSwitch}
            onChartTypeChange={handleChartTypeChange}
            onIntervalChange={handleChartIntervalChange}
            onIndicatorChange={handleIndicatorChange}
            onChartClose={onNativeChartClose}
            onIndicatorSettingsPress={handleIndicatorSettingsPress}
            onIndicatorSelectionConfirm={handleIndicatorSelectionConfirm}
            onCalendarPanelOpen={handleHistoryBoundaryPrefetch}
            onCalendarPanelSubmit={handleCalendarPanelSubmit}
            onFullscreenChange={
              isPresentationManaged ||
              (isMobileControlsLayout && !isNativeChartFullscreen)
                ? undefined
                : onNativeChartFullscreenChange
            }
          />
          <Stack flex={1} position="relative" onLayout={handleChartAreaLayout}>
            <TradingViewNativeChart
              key={`${dataProviderKey}:${candleIntervalSeconds}`}
              enableDrawings={
                enableDrawings &&
                !isCompactDisplayMode &&
                storageNamespace !== 'swap'
              }
              drawingStorageKey={
                panelId
                  ? `${dataProviderKey}:panel:${panelId}`
                  : dataProviderKey
              }
              runtimeRef={chartRuntimeRef}
              candleIntervalSeconds={candleIntervalSeconds}
              chartComponents={chartComponentRenderNodes}
              chartSettings={chartSettings}
              chartType={forcedChartType ?? chartType}
              chartPictureVersion={chartPictureVersion}
              currentPriceLabel={currentPriceLabel}
              extendTimeAxisBorderToCanvasEdge={isCompactDisplayMode}
              hasVolume={false}
              indicatorSeries={indicatorSeries}
              indicatorSeriesSettingsKey={mainIndicatorSettingsKey}
              initialRightOffset={initialRightOffset}
              isMobileLayout={isMobileControlsLayout}
              resizesWithSubIndicatorPanes={Boolean(
                showNativeIndicatorQuickBar &&
                onNativeIndicatorQuickBarChange &&
                !isNativeChartFullscreen,
              )}
              isSwitchingInterval={isSwitchingInterval}
              locale={intl.locale}
              priceAxisTickCount={
                isCompactDisplayMode
                  ? TRADING_VIEW_NATIVE_COMPACT_PRICE_AXIS_TICK_COUNT
                  : undefined
              }
              priceAxisFontSize={
                isCompactDisplayMode
                  ? TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_SIZE
                  : undefined
              }
              showLegend={!isCompactDisplayMode}
              timeAxisFontSize={
                isCompactDisplayMode
                  ? TRADING_VIEW_NATIVE_COMPACT_TIME_AXIS_FONT_SIZE
                  : undefined
              }
              timeAxisHeight={timeAxisHeight}
              timeAxisBorderWidth={isCompactDisplayMode ? 0.5 : undefined}
              onChartWidthChange={setChartWidth}
              onSubIndicatorSettingsPress={handleIndicatorSettingsPress}
              onViewportRequestApplied={handleViewportRequestApplied}
              onVisiblePointRangeChange={handleVisiblePointRangeChange}
              candleLabels={candleLabels}
              points={primarySeriesPoints}
              subIndicatorPanes={subIndicatorPanes}
              testID={testID}
              viewportRequest={viewportRequest}
            />
            {showChartLoadingMask ? (
              <TradingViewChartLoadingMask
                testID={testID ? `${testID}-loading` : undefined}
              />
            ) : null}
            {dataState.status === 'error' && points.length === 0 ? (
              <YStack
                position="absolute"
                top={0}
                right={0}
                bottom={0}
                left={0}
                ai="center"
                jc="center"
                gap="$3"
                bg="$transparent"
                testID={testID ? `${testID}-error` : undefined}
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_no_data })}
                </SizableText>
                <Button
                  size="small"
                  variant="secondary"
                  onPress={handleRetry}
                  testID={testID ? `${testID}-retry` : undefined}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              </YStack>
            ) : null}
            {isMobileControlsLayout &&
            enableNativeChartSettings &&
            !nativeChartSettingsInToolbar &&
            (!isNativeChartFullscreen || isPresentationManaged) ? (
              <TradingViewNativeChartSettingsButton
                panelId={panelId}
                onBeforeOpenSettings={
                  isPresentationManaged ? handleExitFullscreen : undefined
                }
                priceAxisWidth={priceAxisWidth}
                enablePreviousClose={enablePreviousClose}
                isChartSwitchDisabled={isChartSwitchDisabled}
                onChartSwitch={onChartSwitch}
              />
            ) : null}
            {!showChartLoadingMask &&
            isMobileControlsLayout &&
            !isNativeChartFullscreen &&
            !isPresentationManaged &&
            onNativeChartFullscreenChange ? (
              <TradingViewNativeFullscreenButton
                chartHeight={chartHeight}
                isFullscreen={Boolean(isNativeChartFullscreen)}
                onPress={handleMobileFullscreenToggle}
                timeAxisHeight={timeAxisHeight}
                visibleSubIndicatorCount={visibleSubIndicatorCount}
              />
            ) : null}
          </Stack>
          {onNativeIndicatorQuickBarChange && !isNativeChartFullscreen
            ? null
            : nativeIndicatorQuickBar}
        </Stack>
      </TradingViewNativePresentation>
    );
    // Publish committed content while its data and viewport owners remain mounted.
    useLayoutEffect(() => {
      onPresentationContentChange?.(chartContent);
    });
    return onPresentationContentChange ? null : chartContent;
  },
);

TradingViewNativeContent.displayName = 'TradingViewNativeContent';

function PanelTradingViewNativeContainer(
  props: ITradingViewNativeProps & { panelId: string },
) {
  const { chartSettingsState, indicatorSettingsState } =
    useTradingViewPanelSettings(props.panelId);
  return (
    <TradingViewNativeContent
      {...props}
      chartSettingsState={chartSettingsState}
      indicatorSettingsState={indicatorSettingsState}
    />
  );
}

function MarketTradingViewNativeContainer(props: ITradingViewNativeProps) {
  if (props.panelId) {
    return (
      <PanelTradingViewNativeContainer {...props} panelId={props.panelId} />
    );
  }
  return <DefaultMarketTradingViewNativeContainer {...props} />;
}

function DefaultMarketTradingViewNativeContainer(
  props: ITradingViewNativeProps,
) {
  const chartSettingsState = useMarketTradingViewChartSettingsPersistAtom();
  const indicatorSettingsState =
    useMarketTradingViewIndicatorSettingsPersistAtom();
  return (
    <TradingViewNativeContent
      {...props}
      chartSettingsState={chartSettingsState}
      indicatorSettingsState={indicatorSettingsState}
    />
  );
}

function SwapTradingViewNativeContainer(props: ITradingViewNativeProps) {
  const chartSettingsState = useSwapTradingViewChartSettingsPersistAtom();
  const indicatorSettingsState =
    useSwapTradingViewIndicatorSettingsPersistAtom();
  return (
    <TradingViewNativeContent
      {...props}
      chartSettingsState={chartSettingsState}
      indicatorSettingsState={indicatorSettingsState}
    />
  );
}

export const TradingViewNativeContainer = memo(
  (props: ITradingViewNativeProps) => {
    if (props.storageNamespace === 'swap') {
      return <SwapTradingViewNativeContainer {...props} />;
    }
    if (props.enableMultiChart) {
      return (
        <TradingViewNativeMultiChart
          {...props}
          ChartComponent={MarketTradingViewNativeContainer}
        />
      );
    }
    return <MarketTradingViewNativeContainer {...props} />;
  },
);

TradingViewNativeContainer.displayName = 'TradingViewNativeContainer';
