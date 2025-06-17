import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Stack, Tab } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EMarketHomeTab } from '../../types';

import type { IMarketHomeTabValue } from '../../types';

interface IMarketMobileTabsProps {
  selectedTab?: IMarketHomeTabValue;
  onTabChange?: (tabId: IMarketHomeTabValue) => void;
  watchlistContent?: React.ComponentType;
  trendingContent?: React.ComponentType;
}

// Default empty page components
const WatchlistPage = () => <Stack flex={1} />;
const TrendingPage = () => <Stack flex={1} />;

export function MarketMobileTabs({
  selectedTab = EMarketHomeTab.Trending,
  onTabChange,
  watchlistContent: WatchlistContent = WatchlistPage,
  trendingContent: TrendingContent = TrendingPage,
}: IMarketMobileTabsProps) {
  const intl = useIntl();
  const initialIndex = selectedTab === EMarketHomeTab.Watchlist ? 0 : 1;

  const tabData = useMemo(
    () => [
      {
        id: EMarketHomeTab.Watchlist,
        title: 'watchlist',
        page: WatchlistContent,
      },
      {
        id: EMarketHomeTab.Trending,
        title: 'trending',
        page: TrendingContent,
      },
    ],
    [WatchlistContent, TrendingContent],
  );

  // Custom title render: star icon for watchlist tab, translated text for trending
  const renderTitle = (item: { id: IMarketHomeTabValue }) =>
    item.id === EMarketHomeTab.Watchlist ? (
      <Icon name="StarOutline" size="$4" />
    ) : (
      intl.formatMessage({ id: ETranslations.market_trending })
    );

  const handleTabChange = (index: number) => {
    const tabId = tabData[index]?.id as IMarketHomeTabValue;
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
