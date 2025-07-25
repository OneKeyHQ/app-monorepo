import { useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Stack, Tabs } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter, IMarketHomeTabValue } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketMobileTabsProps {
  selectedTab: IMarketHomeTabValue;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
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
  selectedTab,
  onTabChange,
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketMobileTabsProps) {
  const intl = useIntl();

  const tabsRef = useRef<any>(null);

  const watchlistTabName = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_watchlist }),
    [intl],
  );

  const trendingTabName = useMemo(
    () => intl.formatMessage({ id: ETranslations.market_trending }),
    [intl],
  );

  // Sync external selectedTab with internal tabs state
  useEffect(() => {
    const targetTabName =
      selectedTab === 'watchlist' ? watchlistTabName : trendingTabName;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    tabsRef.current?.switchTab?.(targetTabName);
  }, [selectedTab, watchlistTabName, trendingTabName]);

  // Render tabs in order based on selectedTab to ensure correct initial state
  const tabsInOrder =
    selectedTab === 'watchlist'
      ? [
          { name: watchlistTabName, id: 'watchlist' },
          { name: trendingTabName, id: 'trending' },
        ]
      : [
          { name: trendingTabName, id: 'trending' },
          { name: watchlistTabName, id: 'watchlist' },
        ];

  return (
    <Stack flex={1}>
      <Tabs.Container
        ref={tabsRef}
        onTabChange={({ tabName }) => {
          if (tabName === watchlistTabName) {
            onTabChange('watchlist');
          } else if (tabName === trendingTabName) {
            onTabChange('trending');
          }
        }}
      >
        {tabsInOrder.map(({ name, id }) => (
          <Tabs.Tab key={id} name={name}>
            <Stack flex={1} position="relative">
              {id === 'trending' ? (
                <MarketFilterBarSmall {...filterBarProps} />
              ) : null}
              <MarketTokenList
                networkId={selectedNetworkId}
                liquidityFilter={liquidityFilter}
              />
            </Stack>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </Stack>
  );
}
