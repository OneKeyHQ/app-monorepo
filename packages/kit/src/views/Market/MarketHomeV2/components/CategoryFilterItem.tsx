import { memo, useMemo } from 'react';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IIconProps, IXStackProps } from '@onekeyhq/components';
import { useScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';

const ICON_FALLBACK = <Stack w="$4.5" h="$4.5" />;

export const CategoryFilterItem = memo(
  ({
    name,
    isSelected,
    icon,
    iconName,
    iconOnly,
    ...rest
  }: {
    name: string;
    isSelected: boolean;
    icon?: string;
    iconName?: IIconProps['name'];
    iconOnly?: boolean;
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
        {iconName ? (
          <Icon
            name={iconName}
            size="$4.5"
            color={isSelected ? '$icon' : '$iconSubdued'}
          />
        ) : null}
        {!iconName && imageSource ? (
          <Image
            source={imageSource}
            w="$4.5"
            h="$4.5"
            fallback={ICON_FALLBACK}
          />
        ) : null}
        {iconOnly ? null : (
          <SizableText
            numberOfLines={1}
            color={isSelected ? '$text' : '$textSubdued'}
            size="$bodyMdMedium"
          >
            {name}
          </SizableText>
        )}
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
  iconName,
  iconOnly,
  onLayout,
  ...rest
}: {
  id: string;
  name: string;
  isSelected: boolean;
  icon?: string;
  iconName?: IIconProps['name'];
  iconOnly?: boolean;
} & IXStackProps) {
  const { handleItemLayout } = useScrollableFilterBar();
  return (
    <CategoryFilterItem
      name={name}
      isSelected={isSelected}
      icon={icon}
      iconName={iconName}
      iconOnly={iconOnly}
      {...rest}
      onLayout={(event) => {
        handleItemLayout(id, event);
        onLayout?.(event);
      }}
    />
  );
}
