import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

import type {
  FontSizeTokens,
  StackProps,
  XStackProps,
} from '@onekeyhq/components/src/shared/tamagui';

import { Icon, SizableText, Stack, XStack, YStack } from '../../primitives';
import { getFontToken } from '../../utils/getFontSize';

import type { IIconProps, ISizableTextProps } from '../../primitives';

export interface IUnOrderedListItemProps extends XStackProps {
  color?: IIconProps['color'];
  icon?: IIconProps['name'];
  iconProps?: IIconProps;
  description?: string;
  titleSize?: ISizableTextProps['size'];
}

export function UnOrderedListItem({
  children,
  color,
  icon,
  iconProps,
  description,
  titleSize = '$bodyLg',
  ...rest
}: IUnOrderedListItemProps) {
  const titleFontToken = getFontToken(titleSize as FontSizeTokens);
  const titleLineHeight =
    titleFontToken && typeof titleFontToken === 'object'
      ? titleFontToken.lineHeight
      : undefined;

  return (
    <XStack render="li" role="listitem" {...rest}>
      <XStack
        w="$5"
        h={titleLineHeight ?? '$6'}
        justifyContent="center"
        alignItems="center"
      >
        {icon ? (
          <Icon name={icon} color={color} {...iconProps} />
        ) : (
          <XStack
            w="$1.5"
            h="$1.5"
            borderRadius="$full"
            bg={color ?? '$textSubdued'}
          />
        )}
      </XStack>
      <YStack pl="$2" flex={1} minWidth={0}>
        <SizableText render="p" size={titleSize} color={color}>
          {children}
        </SizableText>
        {description ? (
          <SizableText render="p" size="$bodyMd" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

export function UnOrderedList({ children, ...rest }: StackProps) {
  let isFirstItem = true;

  const enhanceChildren = Children.map(children, (child: ReactNode) => {
    if (!isValidElement<IUnOrderedListItemProps>(child)) {
      return child;
    }
    if (isFirstItem) {
      isFirstItem = false;
      return child;
    }
    return cloneElement(child, { pt: '$1' });
  });

  return (
    <Stack p="$0" m="$0" render="ul" role="list" {...rest}>
      {enhanceChildren}
    </Stack>
  );
}

UnOrderedList.Item = UnOrderedListItem;
