import { memo } from 'react';

import { useMedia } from '@onekeyhq/components';
import { ScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CategoryFilterItemWithLayout } from '../CategoryFilterItem';

import { MarketPerpsCategorySelectorDesktop } from './MarketPerpsCategorySelectorDesktop';

import type { IMarketPerpsCategorySelectorProps } from './MarketPerpsCategorySelector.types';

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

function MarketPerpsCategorySelectorImpl(
  props: IMarketPerpsCategorySelectorProps,
) {
  const { md } = useMedia();
  const shouldUseMobileSelector = md || platformEnv.isNative;

  if (shouldUseMobileSelector) {
    return <MarketPerpsCategorySelectorMobile {...props} />;
  }

  return <MarketPerpsCategorySelectorDesktop {...props} />;
}

export const MarketPerpsCategorySelector = memo(
  MarketPerpsCategorySelectorImpl,
);
