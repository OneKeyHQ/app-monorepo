import { memo } from 'react';

import { ScrollView, XStack, useMedia } from '@onekeyhq/components';

import { CategoryFilterItem } from '../CategoryFilterItem';

import type { IMarketCategoryItem } from '../../types';

interface ICategorySelectorProps {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}

function CategorySelectorImpl({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: ICategorySelectorProps) {
  const { md } = useMedia();

  if (md) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 4,
          paddingHorizontal: 20,
          paddingVertical: 8,
        }}
      >
        {categories.map((item) => (
          <CategoryFilterItem
            key={item.id}
            name={item.name}
            icon={item.icon}
            isSelected={item.id === selectedCategoryId}
            onPress={() => onSelectCategory(item.id)}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <XStack
      p="$1"
      gap="$0.5"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      mt="$3"
      mb="$2"
    >
      {categories.map((item) => (
        <CategoryFilterItem
          key={item.id}
          name={item.name}
          icon={item.icon}
          isSelected={item.id === selectedCategoryId}
          onPress={() => onSelectCategory(item.id)}
        />
      ))}
    </XStack>
  );
}

export const CategorySelector = memo(CategorySelectorImpl);
