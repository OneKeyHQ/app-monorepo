import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { ICarouselInstance } from '@onekeyhq/components';
import { Carousel, Tabs, YStack } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useSelectedMarketTabAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IDesktopLayoutProps) {
  const intl = useIntl();
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );
  const [, setSelectedTab] = useSelectedMarketTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_watchlist,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  const carouselRef = useRef<ICarouselInstance>(null);
  const tabNames = useMemo(() => {
    return [watchlistTabName, trendingTabName];
  }, [watchlistTabName, trendingTabName]);

  const focusedTab = useSharedValue(tabNames[1]);

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    setSelectedTab(tabName as IMarketHomeTabValue);
    onTabChange(tabName as IMarketHomeTabValue);
    focusedTab.value = tabName;
    carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
  }, 100);

  const height = useMemo(() => {
    return platformEnv.isNative ? undefined : 'calc(100vh - 96px)';
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      if (item === watchlistTabName) {
        return (
          <YStack px="$4" height={height} flex={1}>
            <MarketWatchlistTokenList
              networkId={selectedNetworkId}
              watchlist={watchlist}
            />
          </YStack>
        );
      }
      return (
        <YStack px="$4" height={height} flex={1}>
          <MarketFilterBar {...filterBarProps} />
          <MarketNormalTokenList networkId={selectedNetworkId} />
        </YStack>
      );
    },
    [filterBarProps, height, selectedNetworkId, watchlist, watchlistTabName],
  );

  return (
    <YStack>
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <Carousel
        disableAnimation
        containerStyle={{ height }}
        ref={carouselRef as any}
        loop={false}
        showPagination={false}
        data={tabNames}
        renderItem={renderItem}
      />
    </YStack>
  );
}
