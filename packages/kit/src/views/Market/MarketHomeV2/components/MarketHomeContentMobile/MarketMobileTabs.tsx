import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
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

// Simple Tab Header Component
interface ISimpleTabHeaderProps {
  data: Array<{ id: IMarketHomeTabValue; title: string }>;
  activeIndex: number;
  onTabPress: (index: number) => void;
  renderTitle: (
    item: { id: IMarketHomeTabValue },
    isActive: boolean,
  ) => React.ReactNode;
}

function SimpleTabHeader({
  data,
  activeIndex,
  onTabPress,
  renderTitle,
}: ISimpleTabHeaderProps) {
  return (
    <XStack
      px="$5"
      py="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      {data.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <Button
            key={item.id}
            variant="tertiary"
            size="small"
            onPress={() => onTabPress(index)}
            mr={index < data.length - 1 ? '$5' : '$0'}
            borderBottomWidth="$0.5"
            borderBottomColor={isActive ? '$borderInteractive' : 'transparent'}
            opacity={isActive ? 1 : 0.6}
            bg="transparent"
          >
            {typeof renderTitle(item, isActive) === 'string' ? (
              <SizableText
                size="$bodyMdMedium"
                color={isActive ? '$textInteractive' : '$text'}
              >
                {renderTitle(item, isActive)}
              </SizableText>
            ) : (
              <Stack>{renderTitle(item, isActive)}</Stack>
            )}
          </Button>
        );
      })}
    </XStack>
  );
}

export function MarketMobileTabs({
  selectedTab = EMarketHomeTab.Trending,
  onTabChange,
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketMobileTabsProps) {
  const intl = useIntl();

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
    (item: { id: IMarketHomeTabValue }, isActive: boolean) =>
      item.id === EMarketHomeTab.Watchlist ? (
        <Icon
          name="StarOutline"
          size="$4"
          color={isActive ? '$textInteractive' : '$icon'}
        />
      ) : (
        intl.formatMessage({ id: ETranslations.market_trending })
      ),
    [intl],
  );

  const handleTabChange = useCallback(
    (index: number) => {
      const tabId = tabData[index]?.id as IMarketHomeTabValue;
      if (tabId) {
        setActiveIndex(index);
        onTabChange?.(tabId);
      }
    },
    [tabData, onTabChange],
  );

  const currentTab = tabData[activeIndex]?.id;

  return (
    <Stack flex={1}>
      <SimpleTabHeader
        data={tabData}
        activeIndex={activeIndex}
        onTabPress={handleTabChange}
        renderTitle={renderTitle}
      />
      <Stack flex={1} position="relative">
        {/* Watchlist Tab Content */}
        <Stack
          flex={1}
          display={currentTab === EMarketHomeTab.Watchlist ? 'flex' : 'none'}
        >
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            defaultShowWatchlistOnly
          />
        </Stack>

        {/* Trending Tab Content */}
        <Stack
          flex={1}
          display={currentTab === EMarketHomeTab.Trending ? 'flex' : 'none'}
        >
          <MarketFilterBarSmall {...filterBarProps} />
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            defaultShowWatchlistOnly={false}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}
