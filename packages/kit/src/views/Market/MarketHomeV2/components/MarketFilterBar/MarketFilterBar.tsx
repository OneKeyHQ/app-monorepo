import { useState } from 'react';

import { XStack, YStack } from '@onekeyhq/components';
import { useShowWatchlistOnlyValue } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { MarketViewToggle } from '../MarketViewToggle';
import { TimeRangeSelector } from '../TimeRangeSelector';

import { MarketFilterBarSkeleton } from './MarketFilterBarSkeleton';

import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  isLoading?: boolean;
}

export function MarketFilterBar({
  selectedNetworkId,
  timeRange = '24h',
  onNetworkIdChange,
  onTimeRangeChange,
  isLoading = false,
}: IMarketFilterBarProps) {
  const [currentTimeRange, setCurrentTimeRange] =
    useState<ITimeRangeSelectorValue>(timeRange);
  const [showWatchlistOnly] = useShowWatchlistOnlyValue();

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setCurrentTimeRange(value);
    onTimeRangeChange?.(value);
  };

  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  if (isLoading) {
    return <MarketFilterBarSkeleton />;
  }

  return (
    <YStack gap="$1" pt="$3">
      <XStack gap="$6" pl="$7" pr="$5">
        <XStack gap="$4">
          {/* Market View Toggle - Trending and Watchlist buttons */}
          <MarketViewToggle />
        </XStack>

        {/* Time Range Selector */}
        <TimeRangeSelector
          value={currentTimeRange}
          onChange={handleTimeRangeChange}
        />
      </XStack>

      {/* Network Selector - Hidden in watchlist mode */}
      {showWatchlistOnly ? null : (
        <MarketTokenListNetworkSelector
          selectedNetworkId={selectedNetworkId}
          onSelectNetworkId={handleNetworkIdChange}
          size="normal"
          forceLoading={isLoading}
        />
      )}
    </YStack>
  );
}
