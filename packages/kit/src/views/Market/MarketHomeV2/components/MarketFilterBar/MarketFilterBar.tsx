import { YStack } from '@onekeyhq/components';

import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';

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
  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  if (isLoading) {
    return <MarketFilterBarSkeleton />;
  }

  return (
    <YStack>
      {/* Network Selector - Hidden in watchlist mode */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
      />
    </YStack>
  );
}
