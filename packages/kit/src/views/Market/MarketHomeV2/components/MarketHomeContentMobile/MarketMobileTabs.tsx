import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Stack, Tab } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketMobileTabsProps {
  selectedTab?: string;
  onTabChange?: (tabId: string) => void;
  watchlistContent?: React.ComponentType;
  trendingContent?: React.ComponentType;
  filterBarProps?: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId?: string;
  liquidityFilter?: ILiquidityFilter;
}

// Page components with actual market content
const WatchlistPage = ({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: {
  filterBarProps?: IMarketMobileTabsProps['filterBarProps'];
  selectedNetworkId?: string;
  liquidityFilter?: ILiquidityFilter;
}) => (
  <Stack flex={1}>
    {filterBarProps ? <MarketFilterBarSmall {...filterBarProps} /> : null}
    <MarketTokenList
      networkId={selectedNetworkId}
      liquidityFilter={liquidityFilter}
      defaultShowWatchlistOnly
    />
  </Stack>
);

const TrendingPage = ({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: {
  filterBarProps?: IMarketMobileTabsProps['filterBarProps'];
  selectedNetworkId?: string;
  liquidityFilter?: ILiquidityFilter;
}) => (
  <Stack flex={1}>
    {filterBarProps ? <MarketFilterBarSmall {...filterBarProps} /> : null}
    <MarketTokenList
      networkId={selectedNetworkId}
      liquidityFilter={liquidityFilter}
      defaultShowWatchlistOnly={false}
    />
  </Stack>
);

export function MarketMobileTabs({
  selectedTab = 'trending',
  onTabChange,
  watchlistContent: WatchlistContent,
  trendingContent: TrendingContent,
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketMobileTabsProps) {
  const intl = useIntl();
  const initialIndex = selectedTab === 'watchlist' ? 0 : 1;

  const tabData = useMemo(() => {
    // Use custom components if provided, otherwise use default pages with market content
    const WatchlistPageComponent =
      WatchlistContent ||
      (() => (
        <WatchlistPage
          filterBarProps={filterBarProps}
          selectedNetworkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
        />
      ));

    const TrendingPageComponent =
      TrendingContent ||
      (() => (
        <TrendingPage
          filterBarProps={filterBarProps}
          selectedNetworkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
        />
      ));

    return [
      {
        id: 'watchlist',
        title: 'watchlist',
        page: WatchlistPageComponent,
      },
      {
        id: 'trending',
        title: 'trending',
        page: TrendingPageComponent,
      },
    ];
  }, [
    WatchlistContent,
    TrendingContent,
    filterBarProps,
    selectedNetworkId,
    liquidityFilter,
  ]);

  // Custom title render: star icon for watchlist tab, translated text for trending
  const renderTitle = (item: { id: string }) =>
    item.id === 'watchlist' ? (
      <Icon name="StarOutline" size="$4" />
    ) : (
      intl.formatMessage({ id: ETranslations.market_trending })
    );

  const handleTabChange = (index: number) => {
    const tabId = tabData[index]?.id;
    if (tabId) {
      onTabChange?.(tabId);
    }
  };

  return (
    <Tab
      data={tabData}
      initialScrollIndex={initialIndex}
      onSelectedPageIndex={handleTabChange}
      headerProps={{
        showHorizontalScrollButton: false,
        itemContainerStyle: { ml: 0, mr: '$5' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        titleFromItem: renderTitle as any,
        px: '$5',
        py: '$3',
      }}
    />
  );
}
