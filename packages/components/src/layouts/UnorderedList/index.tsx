import { Children, cloneElement, isValidElement } from 'react';

import { Icon, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IIconProps, ISizableTextProps } from '../../primitives';
import type { StackProps, XStackProps } from 'tamagui';

export interface IUnOrderedListItemProps extends XStackProps {
  icon?: IIconProps['name'];
  iconProps?: IIconProps;
  description?: string;
  titleSize?: ISizableTextProps['size'];
}

export function UnOrderedListItem({
  children,
  icon,
  iconProps,
  description,
  titleSize = '$bodyLg',
  ...rest
}: IUnOrderedListItemProps) {
  return (
    <XStack tag="li" role="listitem" {...rest}>
      <XStack w="$5" h="$6" justifyContent="center" alignItems="center">
        {icon ? (
          <Icon name={icon} {...iconProps} />
        ) : (
          <XStack w="$1.5" h="$1.5" borderRadius="$full" bg="$textSubdued" />
        )}
      </XStack>
      <YStack pl="$2">
        <SizableText tag="p" size={titleSize}>
          {children}
        </SizableText>
        {description ? (
          <SizableText tag="p" size="$bodyMd" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

export function UnOrderedList({ children, ...rest }: StackProps) {
  let isFirstItem = true;

  const enhanceChildren = Children.map(children, (child) => {
    if (isValidElement<IUnOrderedListItemProps>(child) && isFirstItem) {
      isFirstItem = false;
      return child;
    }
    return cloneElement(child, { pt: '$1' });
  });

  return (
    <Stack p="$0" m="$0" tag="ul" role="list" {...rest}>
      {enhanceChildren}
    </Stack>
  );
}

UnOrderedList.Item = UnOrderedListItem;
