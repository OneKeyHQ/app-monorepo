import { memo, useMemo } from 'react';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { useScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';

const ICON_FALLBACK = <Stack w="$4.5" h="$4.5" />;

export const CategoryFilterItem = memo(
  ({
    name,
    isSelected,
    icon,
    ...rest
  }: {
    name: string;
    isSelected: boolean;
    icon?: string;
  } & IXStackProps) => {
    const { md } = useMedia();
    const imageSource = useMemo(
      () => (icon ? { uri: icon } : undefined),
      [icon],
    );
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
        {imageSource ? (
          <Image
            source={imageSource}
            w="$4.5"
            h="$4.5"
            fallback={ICON_FALLBACK}
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
  icon,
  onLayout,
  ...rest
}: {
  id: string;
  name: string;
  isSelected: boolean;
  icon?: string;
} & IXStackProps) {
  const { handleItemLayout } = useScrollableFilterBar();
  return (
    <CategoryFilterItem
      name={name}
      isSelected={isSelected}
      icon={icon}
      {...rest}
      onLayout={(event) => {
        handleItemLayout(id, event);
        onLayout?.(event);
      }}
    />
  );
}
