import { memo } from 'react';

import { Icon, SizableText, XStack, useMedia } from '@onekeyhq/components';
import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import { useScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';

export const CategoryFilterItem = memo(
  ({
    name,
    isSelected,
    icon,
    ...rest
  }: {
    name: string;
    isSelected: boolean;
    icon?: IKeyOfIcons;
  } & IXStackProps) => {
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
        {icon ? (
          <Icon
            name={icon}
            size="$4.5"
            color={isSelected ? '$text' : '$textSubdued'}
          />
        ) : null}
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyMdMedium"
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
CategoryFilterItem.displayName = 'CategoryFilterItem';

export function CategoryFilterItemWithLayout({
  id,
  name,
  isSelected,
  onPress,
}: {
  id: string;
  name: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { handleItemLayout } = useScrollableFilterBar();
  return (
    <CategoryFilterItem
      name={name}
      isSelected={isSelected}
      onPress={onPress}
      onLayout={(event) => handleItemLayout(id, event)}
    />
  );
}
