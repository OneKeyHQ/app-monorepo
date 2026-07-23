import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getTradingViewNativeKLineInterval } from './data/tradingViewNativeIntervals';
import { useTradingViewNativeKLine } from './data/useTradingViewNativeKLine';
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

import type { ITradingViewNativeProps } from './types';

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
      candleIntervalSeconds,
      chartPictureVersion,
      dataProviderKey,
      dataState,
      points,
      intervalConfig,
      isSwitchingInterval,
      handleIntervalChange,
      handleRetry,
      handleVisiblePointRangeChange,
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

    const handleChartIntervalChange = useCallback(
      (interval: string) => {
        const nextInterval = getTradingViewNativeKLineInterval(interval);
        const fromInterval = intervalConfig.activeInterval;
        if (!nextInterval || nextInterval.value === fromInterval) {
          return;
        }

        handleIntervalChange(nextInterval.value);
        onIntervalChange?.({
          fromInterval,
          toInterval: nextInterval.value,
        });
      },
      [handleIntervalChange, intervalConfig.activeInterval, onIntervalChange],
    );

    useEffect(() => {
      onDataStateChange?.(dataState);
    }, [dataState, onDataStateChange]);

    useEffect(() => {
      onNativeSubIndicatorCountChange?.(0);
    }, [onNativeSubIndicatorCountChange]);

    return (
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <TradingViewNativeChartControlsContainer
          enableNativeChartSettings={enableNativeChartSettings}
          intervalConfig={intervalConfig}
          layoutMode={nativeControlsLayoutMode}
          isFullscreen={isNativeChartFullscreen}
          fullscreenHeader={nativeChartFullscreenHeader}
          onIntervalChange={handleChartIntervalChange}
          onFullscreenChange={onNativeChartFullscreenChange}
        />
        <Stack flex={1} position="relative">
          <TradingViewNativeChart
            key={`${dataProviderKey}:${candleIntervalSeconds}`}
            candleIntervalSeconds={candleIntervalSeconds}
            chartPictureVersion={chartPictureVersion}
            isSwitchingInterval={isSwitchingInterval}
            onVisiblePointRangeChange={handleVisiblePointRangeChange}
            points={points}
            testID={testID}
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
