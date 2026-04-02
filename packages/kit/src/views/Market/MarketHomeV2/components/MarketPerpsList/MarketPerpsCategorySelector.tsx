import { memo } from 'react';

import {
  GradientMask,
  ScrollView,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';
import {
  CategoryFilterItem,
  CategoryFilterItemWithLayout,
} from '../CategoryFilterItem';

interface ICategoryTab {
  tabId: string;
  name: string;
}

interface IMarketPerpsCategorySelectorProps {
  categories: ICategoryTab[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  containerStyle?: Record<string, unknown>;
}

function MarketPerpsCategorySelectorMobile({
  categories,
  selectedCategoryId,
  onSelectCategory,
  containerStyle,
}: IMarketPerpsCategorySelectorProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <ScrollableFilterBar
      selectedItemId={selectedCategoryId}
      itemGap="$2"
      itemPr="$3"
      contentContainerStyle={containerStyle}
    >
      {categories.map((category) => (
        <CategoryFilterItemWithLayout
          key={category.tabId}
          id={category.tabId}
          name={category.name}
          isSelected={category.tabId === selectedCategoryId}
          onPress={() => onSelectCategory(category.tabId)}
        />
      ))}
    </ScrollableFilterBar>
  );
}

function MarketPerpsCategorySelectorDesktop({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: IMarketPerpsCategorySelectorProps) {
  const {
    scrollViewRef,
    shouldShowLeftGradient,
    shouldShowRightGradient,
    handleLayout,
    handleContentSizeChange,
    handleItemLayout,
    handleScroll,
  } = useNetworkFilterScroll();

  if (categories.length === 0) {
    return null;
  }

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
            {categories.map((category) => (
              <CategoryFilterItem
                key={category.tabId}
                name={category.name}
                isSelected={category.tabId === selectedCategoryId}
                onPress={() => onSelectCategory(category.tabId)}
                onLayout={(event) => handleItemLayout(category.tabId, event)}
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

function MarketPerpsCategorySelectorImpl(
  props: IMarketPerpsCategorySelectorProps,
) {
  const { md } = useMedia();

  if (md) {
    return <MarketPerpsCategorySelectorMobile {...props} />;
  }

  return <MarketPerpsCategorySelectorDesktop {...props} />;
}

export const MarketPerpsCategorySelector = memo(
  MarketPerpsCategorySelectorImpl,
);
