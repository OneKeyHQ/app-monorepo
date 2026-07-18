import { memo, useEffect } from 'react';

import { Stack } from '@onekeyhq/components';

import { TradingViewNativeChartControlsContainer } from '../TradingViewNativeChartControlsContainer';
import { useTradingViewNativeKLine } from '../useTradingViewNativeKLine';

import { TradingViewNativeChart } from './TradingViewNativeChart';

import type { ITradingViewNativeProps } from '../types';

export const TradingViewNative = memo(
  ({
    testID,
    networkId = '',
    tokenAddress = '',
    nativeControlsLayoutMode,
    onNativeSubIndicatorCountChange,
  }: ITradingViewNativeProps) => {
    const {
      candleIntervalSeconds,
      points,
      intervalConfig,
      isSwitchingInterval,
      handleIntervalChange,
    } = useTradingViewNativeKLine({ networkId, tokenAddress });

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
          candleIntervalSeconds={candleIntervalSeconds}
          isSwitchingInterval={isSwitchingInterval}
          points={points}
          testID={testID}
        />
      </Stack>
    );
  },
);

TradingViewNative.displayName = 'TradingViewNative';
