import { memo } from 'react';

import {
  GradientMask,
  ScrollView,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';

function CategoryFilterItem({
  name,
  isSelected,
  ...rest
}: {
  name: string;
  isSelected: boolean;
} & IXStackProps) {
  const { md } = useMedia();
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      px="$2.5"
      py="$1.5"
      gap={md ? '$1' : '$2'}
      borderRadius={md ? '$full' : '$2.5'}
      userSelect="none"
      backgroundColor={isSelected ? '$bgActive' : '$transparent'}
      {...(!isSelected && {
        focusable: true,
        hoverStyle: {
          bg: '$bgStrongHover',
        },
        pressStyle: {
          bg: '$bgStrongActive',
        },
        focusVisibleStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
        },
      })}
      {...rest}
    >
      <SizableText
        numberOfLines={1}
        color={isSelected ? '$text' : '$textSubdued'}
        size="$bodyMdMedium"
      >
        {name}
      </SizableText>
    </XStack>
  );
}

interface ICategoryTab {
  tabId: string;
  name: string;
}

interface IMarketPerpsCategorySelectorProps {
  categories: ICategoryTab[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

function MarketPerpsCategorySelectorImpl({
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

export const MarketPerpsCategorySelector = memo(
  MarketPerpsCategorySelectorImpl,
);
