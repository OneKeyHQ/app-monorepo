import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  GradientMask,
  ScrollView,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';
import {
  CategoryFilterItem,
  CategoryFilterItemWithLayout,
} from '../CategoryFilterItem';

export type IWatchlistFilterType = 'all' | 'spot' | 'perps';

interface IMarketWatchlistCategorySelectorProps {
  selectedFilter: IWatchlistFilterType;
  onSelectFilter: (filter: IWatchlistFilterType) => void;
  containerStyle?: Record<string, unknown>;
}

function useWatchlistFilterCategories() {
  const intl = useIntl();
  return useMemo(
    () => [
      {
        id: 'all' as const,
        name: intl.formatMessage({ id: ETranslations.global_all }),
      },
      {
        id: 'spot' as const,
        name: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      },
      {
        id: 'perps' as const,
        name: intl.formatMessage({ id: ETranslations.global_perp }),
      },
    ],
    [intl],
  );
}

function MarketWatchlistCategorySelectorMobile({
  selectedFilter,
  onSelectFilter,
  containerStyle,
}: IMarketWatchlistCategorySelectorProps) {
  const categories = useWatchlistFilterCategories();
  const handleSelect = useCallback(
    (id: string) => onSelectFilter(id as IWatchlistFilterType),
    [onSelectFilter],
  );

  return (
    <ScrollableFilterBar
      selectedItemId={selectedFilter}
      itemGap="$2"
      itemPr="$3"
      contentContainerStyle={containerStyle}
    >
      {categories.map((c) => (
        <CategoryFilterItemWithLayout
          key={c.id}
          id={c.id}
          name={c.name}
          isSelected={c.id === selectedFilter}
          onPress={() => handleSelect(c.id)}
        />
      ))}
    </ScrollableFilterBar>
  );
}

function MarketWatchlistCategorySelectorDesktop({
  selectedFilter,
  onSelectFilter,
}: IMarketWatchlistCategorySelectorProps) {
  const categories = useWatchlistFilterCategories();
  const handleSelect = useCallback(
    (id: string) => onSelectFilter(id as IWatchlistFilterType),
    [onSelectFilter],
  );

  const {
    scrollViewRef,
    shouldShowLeftGradient,
    shouldShowRightGradient,
    handleLayout,
    handleContentSizeChange,
    handleItemLayout,
    handleScroll,
  } = useNetworkFilterScroll();

  return (
    <XStack
      position="relative"
      p="$1"
      gap="$1"
      mt="$3"
      mb="$2"
      maxWidth="100%"
      overflow="hidden"
      borderWidth={1}
      borderColor="$neutral4"
      borderRadius="$3"
    >
      <XStack flex={1} position="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
        >
          <XStack gap="$0.5">
            {categories.map((c) => (
              <CategoryFilterItem
                key={c.id}
                name={c.name}
                isSelected={c.id === selectedFilter}
                onPress={() => handleSelect(c.id)}
                onLayout={(event) => handleItemLayout(c.id, event)}
              />
            ))}
          </XStack>
        </ScrollView>

        <GradientMask
          opacity={shouldShowLeftGradient ? 1 : 0}
          position="left"
        />
        <GradientMask
          opacity={shouldShowRightGradient ? 1 : 0}
          position="right"
        />
      </XStack>
    </XStack>
  );
}

function MarketWatchlistCategorySelectorImpl(
  props: IMarketWatchlistCategorySelectorProps,
) {
  const { md } = useMedia();

  if (md) {
    return <MarketWatchlistCategorySelectorMobile {...props} />;
  }

  return <MarketWatchlistCategorySelectorDesktop {...props} />;
}

export const MarketWatchlistCategorySelector = memo(
  MarketWatchlistCategorySelectorImpl,
);
