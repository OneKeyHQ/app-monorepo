import { Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketTokenList } from '../components/MarketTokenList';
import { ToggleButton } from '../components/MarketViewToggle/MarketViewToggle';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
  activeTab: IMarketHomeTabValue;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function MobileLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMobileLayoutProps) {
  return (
    <Stack flex={1}>
      {/* Tab Header using ToggleButton style from MarketViewToggle */}
      <XStack gap="$6" px="$4" py="$2">
        <ToggleButton
          isActive={activeTab === 'watchlist'}
          onPress={
            activeTab !== 'watchlist'
              ? () => onTabChange('watchlist')
              : undefined
          }
          disabled={false}
          translationId={ETranslations.global_watchlist}
          defaultMessage="Watchlist"
        />
        <ToggleButton
          isActive={activeTab === 'trending'}
          onPress={
            activeTab !== 'trending' ? () => onTabChange('trending') : undefined
          }
          disabled={false}
          translationId={ETranslations.market_trending}
          defaultMessage="Trending"
        />
      </XStack>

      {/* Tab Content */}
      <Stack flex={1} position="relative">
        {activeTab === 'trending' ? (
          <MarketFilterBarSmall {...filterBarProps} />
        ) : null}
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
        />
      </Stack>
    </Stack>
  );
}
