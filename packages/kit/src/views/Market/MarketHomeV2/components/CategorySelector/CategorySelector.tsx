import { memo, useCallback } from 'react';
import type { KeyboardEvent } from 'react';

import { ScrollView, XStack, useMedia } from '@onekeyhq/components';

import { CategoryFilterItem } from '../CategoryFilterItem';

import type { IMarketCategoryItem } from '../../types';

interface ICategorySelectorProps {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  triggerOnPressDown?: boolean;
}

function CategorySelectorImpl({
  categories,
  selectedCategoryId,
  onSelectCategory,
  triggerOnPressDown = false,
}: ICategorySelectorProps) {
  const { md } = useMedia();
  const getCategoryInteractionProps = useCallback(
    (categoryId: string) => {
      const handleSelect = () => {
        onSelectCategory(categoryId);
      };

      if (!triggerOnPressDown) {
        return {
          onPress: handleSelect,
        };
      }

      return {
        onPressIn: handleSelect,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          handleSelect();
        },
      };
    },
    [onSelectCategory, triggerOnPressDown],
  );

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
            {...getCategoryInteractionProps(item.id)}
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
          {...getCategoryInteractionProps(item.id)}
        />
      ))}
    </XStack>
  );
}

export const CategorySelector = memo(CategorySelectorImpl);
