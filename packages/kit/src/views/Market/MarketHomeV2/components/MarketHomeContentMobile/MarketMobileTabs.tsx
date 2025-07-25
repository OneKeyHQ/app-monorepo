import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack, Tabs } from '@onekeyhq/components';
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

  const watchlistTabName = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_watchlist }),
    [intl],
  );

  const trendingTabName = useMemo(
    () => intl.formatMessage({ id: ETranslations.market_trending }),
    [intl],
  );

  return (
    <Stack flex={1}>
      <Tabs.Container>
        <Tabs.Tab name={watchlistTabName}>
          <Stack flex={1} position="relative">
            <MarketTokenList
              networkId={selectedNetworkId}
              liquidityFilter={liquidityFilter}
            />
          </Stack>
        </Tabs.Tab>

        <Tabs.Tab name={trendingTabName}>
          <Stack flex={1} position="relative">
            <MarketFilterBarSmall {...filterBarProps} />
            <MarketTokenList
              networkId={selectedNetworkId}
              liquidityFilter={liquidityFilter}
            />
          </Stack>
        </Tabs.Tab>
      </Tabs.Container>
    </Stack>
  );
}
