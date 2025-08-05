import { XStack, YStack } from '@onekeyhq/components';
import { useShowWatchlistOnlyValue } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { MarketViewToggle } from '../MarketViewToggle';

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
  onNetworkIdChange,
  isLoading = false,
}: IMarketFilterBarProps) {
  const [showWatchlistOnly] = useShowWatchlistOnlyValue();

  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  if (isLoading) {
    return <MarketFilterBarSkeleton />;
  }

  return (
    <YStack gap="$1" pt="$3" px="$6">
      <XStack pl="$3">
        <MarketViewToggle />
      </XStack>

      {/* Network Selector - Hidden in watchlist mode */}
      {showWatchlistOnly ? null : (
        <MarketTokenListNetworkSelector
          selectedNetworkId={selectedNetworkId}
          onSelectNetworkId={handleNetworkIdChange}
          forceLoading={isLoading}
        />
      )}
    </YStack>
  );
}
