import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EMarketHomeTab } from '../../types';
import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter, IMarketHomeTabValue } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketHomeContentMobileProps {
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

export function MarketHomeContentMobile({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMarketHomeContentMobileProps) {
  const intl = useIntl();

  // --------------------- Header Buttons --------------------- //
  const handleTabPress = useCallback(
    (tabId: IMarketHomeTabValue) => {
      if (tabId !== activeTab) {
        onTabChange?.(tabId);
      }
    },
    [activeTab, onTabChange],
  );

  // --------------------- Pages --------------------- //
  const renderContent = useCallback(() => {
    if (activeTab === EMarketHomeTab.Watchlist) {
      return (
        <Stack flex={1}>
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            defaultShowWatchlistOnly
          />
        </Stack>
      );
    }
    // Trending
    return (
      <Stack flex={1}>
        <MarketFilterBarSmall {...filterBarProps} />
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          defaultShowWatchlistOnly={false}
        />
      </Stack>
    );
  }, [activeTab, filterBarProps, liquidityFilter, selectedNetworkId]);

  return (
    <Stack flex={1}>
      {/* Header Buttons */}
      <XStack gap="$3" px="$5" py="$3" alignItems="center">
        <Button
          size="small"
          variant={
            activeTab === EMarketHomeTab.Watchlist ? 'primary' : 'tertiary'
          }
          icon="StarOutline"
          onPress={() => handleTabPress(EMarketHomeTab.Watchlist)}
        />
        <Button
          size="small"
          variant={
            activeTab === EMarketHomeTab.Trending ? 'primary' : 'tertiary'
          }
          onPress={() => handleTabPress(EMarketHomeTab.Trending)}
        >
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </Button>
      </XStack>
      {renderContent()}
    </Stack>
  );
}
