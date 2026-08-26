import { memo } from 'react';

import {
  GradientMask,
  ScrollView,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';
import {
  CategoryFilterItem,
  CategoryFilterItemWithLayout,
} from '../CategoryFilterItem';

import type { IMarketCategoryItem } from '../../types';

interface IMarketStockCategorySelectorProps {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  containerStyle?: Record<string, unknown>;
}

function MarketStockCategorySelectorImpl({
  categories,
  selectedCategoryId,
  onSelectCategory,
  containerStyle,
}: IMarketStockCategorySelectorProps) {
  const { md } = useMedia();
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

  if (!md && !platformEnv.isNative) {
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
                  key={category.id}
                  name={category.name}
                  isSelected={category.id === selectedCategoryId}
                  onPress={() => onSelectCategory(category.id)}
                  onLayout={(event) => handleItemLayout(category.id, event)}
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

  return (
    <ScrollableFilterBar
      selectedItemId={selectedCategoryId}
      itemGap="$2"
      itemPr="$3"
      contentContainerStyle={containerStyle}
    >
      {categories.map((category) => (
        <CategoryFilterItemWithLayout
          key={category.id}
          id={category.id}
          name={category.name}
          isSelected={category.id === selectedCategoryId}
          onPress={() => onSelectCategory(category.id)}
        />
      ))}
    </ScrollableFilterBar>
  );
}

export const MarketStockCategorySelector = memo(
  MarketStockCategorySelectorImpl,
);
