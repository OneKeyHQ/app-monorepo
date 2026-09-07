import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import { useTradingViewSettingsThemeColors } from '../TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';
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
import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';
import { TradingViewNativeChartSettingsButton } from './TradingViewNativeChartSettingsButton';
import { TradingViewNativeFullscreenButton } from './TradingViewNativeFullscreenButton';
import { useTradingViewNativeChartComponents } from './useTradingViewNativeChartComponents';
import {
  type ITradingViewNativeAnyIndicator,
  type ITradingViewNativeSubIndicator,
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  buildTradingViewNativeIndicatorSeries,
} from './utils/chartIndicators';
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
import type {
  ITradingViewNativeChartType,
  ITradingViewNativeDataState,
  ITradingViewNativeProps,
} from './types';
import type { ITradingViewNativeViewportTarget } from './utils/chartViewport';
import type { ITradingViewNativeSubIndicatorInstanceConfig } from './utils/subIndicatorRender/types';
import type { ICalendarPanelSubmitPayload } from '../TradingViewChartControls/calendarControls/CalendarPanelPopover';
import type { ITradingViewNativeIndicatorSelection } from '../TradingViewChartControls/types';
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

export const TradingViewNativeContainer = memo(
  ({
    testID,
    source,
    forcedChartType,
    chartComponents,
    enableNativeChartSettings,
    initialRightOffset,
    nativeChartDisplayMode,
    maxSelectableSubIndicatorCount,
    nativeControlsLayoutMode,
    nativeControlsFlushHorizontalInset,
    showNativeChartCloseControl,
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
    isChartSwitchDisabled,
    onChartSwitch,
    onDataStateChange,
    onIntervalChange,
    onNativeChartClose,
    onNativeSubIndicatorCountChange,
    onNativeChartFullscreenChange,
    onPriceUpdate,
  }: ITradingViewNativeProps) => {
    const intl = useIntl();
    const themeColors = useTradingViewSettingsThemeColors();
    const [storedChartSettings, setStoredChartSettings] =
      useMarketTradingViewChartSettingsPersistAtom();
    const [indicatorSettings, setIndicatorSettings] =
      useMarketTradingViewIndicatorSettingsPersistAtom();
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
    const visibleSubIndicatorCount = useMemo(
      () =>
        subIndicatorInstances.reduce(
          (count, instance) =>
            instance.isVisible !== false ? count + 1 : count,
          0,
        ),
      [subIndicatorInstances],
    );
    onPriceUpdateRef.current = onPriceUpdate;
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
      onRealtimePoint: handleRealtimePoint,
      source,
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
        buildTradingViewNativeIndicatorSeries({
          activeIndicatorValues: activeMainIndicatorValues,
          indicatorSettings: mainIndicatorSettings,
          points: primarySeriesPoints,
        }),
      [activeMainIndicatorValues, mainIndicatorSettings, primarySeriesPoints],
    );
    const visibleSubIndicatorInstances = useMemo(
      () =>
        subIndicatorInstances
          .filter((instance) => instance.isVisible !== false)
          .map(resolveTradingViewNativeSubIndicatorInstance),
      [subIndicatorInstances],
    );
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
    const chartComponentRenderNodes = useTradingViewNativeChartComponents({
      chartComponents,
      dataProviderKey,
      latestPrice,
      referenceLineColor:
        themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.referenceLine],
      showPreviousClose: normalizedChartSettings.options.previousClose,
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
    const handleIndicatorSelectionConfirm = useCallback(
      ({
        activeIndicatorValues: selectedIndicatorValues,
        replaceMainIndicators,
        replaceSubIndicators,
      }: ITradingViewNativeIndicatorSelection) => {
        void setIndicatorSettings((currentSettings) =>
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
    const handleIndicatorSettingsPress = useCallback(
      (indicator?: ITradingViewNativeAnyIndicator) => {
        showTradingViewNativeIndicatorSettingsDialog({
          displayMode:
            nativeControlsLayoutMode === 'desktop' ? 'full' : 'focused',
          initialIndicatorId: indicator,
          intl,
          onConfirm: setIndicatorSettings,
          value: indicatorSettingsValue,
        });
      },
      [
        indicatorSettingsValue,
        intl,
        nativeControlsLayoutMode,
        setIndicatorSettings,
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

    return (
      <Stack flex={1} w="100%" h="100%" bg="$transparent">
        <TradingViewNativeChartControlsContainer
          activeChartType={chartType}
          calendarAvailableTimeRange={calendarAvailableTimeRange}
          compactMobileLayout={isCompactDisplayMode}
          enableNativeChartSettings={enableNativeChartSettings}
          intervalConfig={intervalConfig}
          activeIndicatorValues={activeIndicatorValues}
          maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
          layoutMode={nativeControlsLayoutMode}
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
            isMobileControlsLayout ? undefined : onNativeChartFullscreenChange
          }
        />
        <Stack flex={1} position="relative" onLayout={handleChartAreaLayout}>
          <TradingViewNativeChart
            key={`${dataProviderKey}:${candleIntervalSeconds}`}
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
          {isMobileControlsLayout && enableNativeChartSettings ? (
            <TradingViewNativeChartSettingsButton
              priceAxisWidth={priceAxisWidth}
              isChartSwitchDisabled={isChartSwitchDisabled}
              onChartSwitch={onChartSwitch}
            />
          ) : null}
          {!showChartLoadingMask &&
          isMobileControlsLayout &&
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
      </Stack>
    );
  },
);

TradingViewNativeContainer.displayName = 'TradingViewNativeContainer';
