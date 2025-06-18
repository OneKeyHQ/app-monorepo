import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Stack, Tab } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EMarketHomeTab } from '../../types';
import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter, IMarketHomeTabValue } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketMobileTabsProps {
  selectedTab?: IMarketHomeTabValue;
  onTabChange?: (tabId: IMarketHomeTabValue) => void;
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
}

export function MarketMobileTabs({
  selectedTab = EMarketHomeTab.Trending,
  onTabChange,
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketMobileTabsProps) {
  const intl = useIntl();
  const initialIndex = selectedTab === EMarketHomeTab.Watchlist ? 0 : 1;

  const WatchlistPageComponent = useCallback(
    () => (
      <Stack flex={1}>
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          defaultShowWatchlistOnly
        />
      </Stack>
    ),
    [selectedNetworkId, liquidityFilter],
  );

  const TrendingPageComponent = useCallback(
    () => (
      <Stack flex={1}>
        <MarketFilterBarSmall {...filterBarProps} />
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          defaultShowWatchlistOnly={false}
        />
      </Stack>
    ),
    [filterBarProps, selectedNetworkId, liquidityFilter],
  );

  const tabData = useMemo(
    () => [
      {
        id: EMarketHomeTab.Watchlist,
        title: 'watchlist',
        page: WatchlistPageComponent,
      },
      {
        id: EMarketHomeTab.Trending,
        title: 'trending',
        page: TrendingPageComponent,
      },
    ],
    [WatchlistPageComponent, TrendingPageComponent],
  );

  // Custom title render: star icon for watchlist tab, translated text for trending
  const renderTitle = useCallback(
    (item: { id: IMarketHomeTabValue }) =>
      item.id === EMarketHomeTab.Watchlist ? (
        <Icon name="StarOutline" size="$4" />
      ) : (
        intl.formatMessage({ id: ETranslations.market_trending })
      ),
    [intl],
  );

  // Move the headerProps object creation into a memo to keep a stable reference between renders
  const headerProps = useMemo(
    () => ({
      showHorizontalScrollButton: false,
      itemContainerStyle: { ml: 0, mr: '$5' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      titleFromItem: renderTitle as any,
      px: '$5',
      py: '$3',
    }),
    [renderTitle],
  );

  const handleTabChange = (index: number) => {
    const tabId = tabData[index]?.id as IMarketHomeTabValue;
    if (tabId) {
      onTabChange?.(tabId);
    }
  };

  return (
    <Tab.Page
      data={tabData}
      initialScrollIndex={initialIndex}
      onSelectedPageIndex={handleTabChange}
      headerProps={headerProps}
    />
  );
}
