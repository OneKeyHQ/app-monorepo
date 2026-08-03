import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildTradingViewNativeGoToDateTimeRange,
  getTradingViewNativeKLineInterval,
  getTradingViewNativeKLineIntervalForTimeRange,
} from './data/tradingViewNativeIntervals';
import { useTradingViewNativeKLine } from './data/useTradingViewNativeKLine';
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';
import type { ITradingViewNativeProps } from './types';
import type { ITradingViewNativeViewportTarget } from './utils/chartViewport';
import type { ICalendarPanelSubmitPayload } from '../TradingViewChartControls/calendarControls/CalendarPanelPopover';

export const TradingViewNativeContainer = memo(
  ({
    testID,
    source,
    enableNativeChartSettings,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
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
    const latestPoint = points[points.length - 1];
    const latestPrice = latestPoint?.c;
    const latestPriceTimestamp = latestPoint?.t;

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
          return;
        }

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
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <TradingViewNativeChartControlsContainer
          calendarAvailableTimeRange={calendarAvailableTimeRange}
          enableNativeChartSettings={enableNativeChartSettings}
          intervalConfig={intervalConfig}
          layoutMode={nativeControlsLayoutMode}
          isFullscreen={isNativeChartFullscreen}
          fullscreenHeader={nativeChartFullscreenHeader}
          onIntervalChange={handleChartIntervalChange}
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
            isSwitchingInterval={isSwitchingInterval}
            onChartWidthChange={setChartWidth}
            onViewportRequestApplied={handleViewportRequestApplied}
            onVisiblePointRangeChange={handleVisiblePointRangeChange}
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
              bg="$bgApp"
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
