import { YStack } from '@onekeyhq/components';

import { CategorySelector } from '../CategorySelector';

import type { IMarketCategoryItem } from '../../types';

export interface IMarketFilterBarComponentProps {
  selectedCategory?: string;
  categories?: IMarketCategoryItem[];
  onCategoryChange?: (category: string) => void;
}

export function MarketFilterBar({
  selectedCategory = 'trending',
  categories = [],
  onCategoryChange,
}: IMarketFilterBarComponentProps) {
  if (!onCategoryChange || categories.length === 0) {
    return null;
  }

  return (
    <YStack>
      <CategorySelector
        categories={categories}
        selectedCategoryId={selectedCategory}
        onSelectCategory={onCategoryChange}
        triggerOnPressDown
      />
    </YStack>
  );
}
