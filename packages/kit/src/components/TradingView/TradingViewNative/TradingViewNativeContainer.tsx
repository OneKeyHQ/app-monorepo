import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';
import {
  DEFAULT_TRADING_VIEW_NATIVE_INDICATORS,
  type ITradingViewNativeIndicator,
  buildTradingViewNativeIndicatorSeries,
} from './utils/chartIndicators';
import { hasTradingViewNativeVolume } from './utils/chartLayout';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';
import type {
  ITradingViewNativeDataState,
  ITradingViewNativeProps,
} from './types';
import type { ITradingViewNativeViewportTarget } from './utils/chartViewport';
import type { ICalendarPanelSubmitPayload } from '../TradingViewChartControls/calendarControls/CalendarPanelPopover';

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
    enableNativeChartSettings,
    initialRightOffset,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
    onChartSwitch,
    onDataStateChange,
    onIntervalChange,
    onNativeSubIndicatorCountChange,
    onNativeChartFullscreenChange,
    onPriceUpdate,
  }: ITradingViewNativeProps) => {
    const intl = useIntl();
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
    const [activeIndicatorValues, setActiveIndicatorValues] = useState<
      Set<string>
    >(() => new Set(DEFAULT_TRADING_VIEW_NATIVE_INDICATORS));
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
      chartType,
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
    const hasVolume = useMemo(
      () => hasTradingViewNativeVolume(points),
      [points],
    );
    const indicatorSeries = useMemo(
      () =>
        buildTradingViewNativeIndicatorSeries({
          activeIndicatorValues,
          points,
        }),
      [activeIndicatorValues, points],
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

    const handleIndicatorChange = useCallback(
      (indicator: ITradingViewNativeIndicator, desiredActive: boolean) => {
        setActiveIndicatorValues((currentValues) => {
          if (currentValues.has(indicator) === desiredActive) {
            return currentValues;
          }
          const nextValues = new Set(currentValues);
          if (desiredActive) {
            nextValues.add(indicator);
          } else {
            nextValues.delete(indicator);
          }
          return nextValues;
        });
      },
      [],
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
      onNativeSubIndicatorCountChange?.(0);
    }, [onNativeSubIndicatorCountChange]);

    return (
      <Stack flex={1} w="100%" h="100%" bg="$transparent">
        <TradingViewNativeChartControlsContainer
          calendarAvailableTimeRange={calendarAvailableTimeRange}
          enableNativeChartSettings={enableNativeChartSettings}
          intervalConfig={intervalConfig}
          activeIndicatorValues={activeIndicatorValues}
          layoutMode={nativeControlsLayoutMode}
          isFullscreen={isNativeChartFullscreen}
          fullscreenHeader={nativeChartFullscreenHeader}
          onChartSwitch={onChartSwitch}
          onIntervalChange={handleChartIntervalChange}
          onIndicatorChange={handleIndicatorChange}
          onCalendarPanelOpen={handleHistoryBoundaryPrefetch}
          onCalendarPanelSubmit={handleCalendarPanelSubmit}
          onFullscreenChange={onNativeChartFullscreenChange}
        />
        <Stack flex={1} position="relative">
          <TradingViewNativeChart
            key={`${dataProviderKey}:${candleIntervalSeconds}`}
            candleIntervalSeconds={candleIntervalSeconds}
            chartType={chartType}
            chartPictureVersion={chartPictureVersion}
            hasVolume={hasVolume}
            indicatorSeries={indicatorSeries}
            initialRightOffset={initialRightOffset}
            isSwitchingInterval={isSwitchingInterval}
            onChartWidthChange={setChartWidth}
            onViewportRequestApplied={handleViewportRequestApplied}
            onVisiblePointRangeChange={handleVisiblePointRangeChange}
            candleLabels={candleLabels}
            points={points}
            testID={testID}
            viewportRequest={viewportRequest}
          />
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
        </Stack>
      </Stack>
    );
  },
);

TradingViewNativeContainer.displayName = 'TradingViewNativeContainer';
