import { memo, useEffect } from 'react';

import { Stack } from '@onekeyhq/components';

import { useTradingViewNativeKLine } from './data/useTradingViewNativeKLine';
import { TradingViewNativeChart } from './TradingViewNativeChart';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

import type { ITradingViewNativeProps } from './types';

export const TradingViewNativeContainer = memo(
  ({
    testID,
    source,
    nativeControlsLayoutMode,
    onDataStateChange,
    onNativeSubIndicatorCountChange,
  }: ITradingViewNativeProps) => {
    const {
      candleIntervalSeconds,
      dataProviderKey,
      dataState,
      points,
      intervalConfig,
      isSwitchingInterval,
      handleIntervalChange,
      handleVisiblePointRangeChange,
    } = useTradingViewNativeKLine({ source });

    useEffect(() => {
      onDataStateChange?.(dataState);
    }, [dataState, onDataStateChange]);

    useEffect(() => {
      onNativeSubIndicatorCountChange?.(0);
    }, [onNativeSubIndicatorCountChange]);

    return (
      <Stack flex={1} w="100%" h="100%" bg="$bgApp">
        <TradingViewNativeChartControlsContainer
          intervalConfig={intervalConfig}
          layoutMode={nativeControlsLayoutMode}
          onIntervalChange={handleIntervalChange}
        />
        <TradingViewNativeChart
          key={`${dataProviderKey}:${candleIntervalSeconds}`}
          candleIntervalSeconds={candleIntervalSeconds}
          isSwitchingInterval={isSwitchingInterval}
          onVisiblePointRangeChange={handleVisiblePointRangeChange}
          points={points}
          testID={testID}
        />
      </Stack>
    );
  },
);

TradingViewNativeContainer.displayName = 'TradingViewNativeContainer';
