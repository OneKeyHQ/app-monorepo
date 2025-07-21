import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Stack, XStack } from '@onekeyhq/components';
import { useShowWatchlistOnlyActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/actions';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SimpleTabHeader } from '../../../components/SimpleTabHeader';
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
  const { current: showWatchlistOnlyActions } = useShowWatchlistOnlyActions();

  const [activeIndex, setActiveIndex] = useState(
    selectedTab === EMarketHomeTab.Watchlist ? 0 : 1,
  );

  const tabData = useMemo(
    () => [
      {
        id: EMarketHomeTab.Watchlist,
        title: intl.formatMessage({ id: ETranslations.global_watchlist }),
      },
      {
        id: EMarketHomeTab.Trending,
        title: intl.formatMessage({ id: ETranslations.market_trending }),
      },
    ],
    [intl],
  );

  // Custom title render: star icon for watchlist tab, translated text for trending
  const renderTitle = useCallback(
    (
      item: { id: IMarketHomeTabValue; title: string },
      index: number,
      isActive: boolean,
    ) =>
      item.id === EMarketHomeTab.Watchlist ? (
        <Icon
          name="StarOutline"
          size="$4"
          color={isActive ? '$text' : '$iconSubdued'}
        />
      ) : (
        intl.formatMessage({ id: ETranslations.market_trending })
      ),
    [intl],
  );

  const handleTabChange = useCallback(
    (index: number, tabId: IMarketHomeTabValue) => {
      if (tabId) {
        setActiveIndex(index);
        onTabChange?.(tabId);

        // Update the showWatchlistOnly atom based on the selected tab
        showWatchlistOnlyActions.setShowWatchlistOnly(
          tabId === EMarketHomeTab.Watchlist,
        );
      }
    },
    [onTabChange, showWatchlistOnlyActions],
  );

  const currentTab = tabData[activeIndex]?.id;

  return (
    <Stack flex={1}>
      <SimpleTabHeader<IMarketHomeTabValue>
        data={tabData}
        activeIndex={activeIndex}
        onTabPress={handleTabChange}
        renderTitle={renderTitle}
      />
      <Stack flex={1} position="relative">
        {currentTab === EMarketHomeTab.Trending ? (
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
