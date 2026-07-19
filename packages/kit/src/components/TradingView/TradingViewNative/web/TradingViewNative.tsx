import { memo } from 'react';

import { Stack } from '@onekeyhq/components';

import { useTradingViewNativeKLine } from '../data/useTradingViewNativeKLine';
import { TradingViewNativeChartControlsContainer } from '../TradingViewNativeChartControlsContainer';

import { TradingViewNativeChart } from './TradingViewNativeChart';

import type { ITradingViewNativeProps } from '../types';

export const TradingViewNative = memo(
  ({
    testID,
    networkId = '',
    tokenAddress = '',
    symbol = '',
    hyperliquidCoin = '',
    dataSource = 'market-polling',
    nativeControlsLayoutMode,
  }: ITradingViewNativeProps) => {
    const {
      candleIntervalSeconds,
      dataProviderKey,
      points,
      intervalConfig,
      isSwitchingInterval,
      handleIntervalChange,
    } = useTradingViewNativeKLine({
      networkId,
      tokenAddress,
      symbol,
      hyperliquidCoin,
      dataSource,
    });

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
          points={points}
          testID={testID}
        />
      </Stack>
    );
  },
);

TradingViewNative.displayName = 'TradingViewNative';
