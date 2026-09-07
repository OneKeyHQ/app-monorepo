import { GradientMask, ScrollView, XStack } from '@onekeyhq/components';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';
import { CategoryFilterItem } from '../CategoryFilterItem';

import type { IMarketPerpsCategorySelectorProps } from './MarketPerpsCategorySelector.types';

export function MarketPerpsCategorySelectorDesktop({
  categories,
  selectedCategoryId,
  onSelectCategory,
  containerStyle,
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
    // Same plain frame the Stocks selector uses: the shared toolbar band owns
    // the spacing, so the selector carries no border, margin or padding.
    <XStack
      position="relative"
      maxWidth="100%"
      overflow="hidden"
      {...containerStyle}
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
