import { Children, cloneElement, isValidElement } from 'react';

import { Icon, Stack, Text, XStack } from '../../primitives';

import type { IIconProps } from '../../primitives';
import type { StackProps, XStackProps } from 'tamagui';

export interface IUnOrderedListItemProps extends XStackProps {
  icon?: IIconProps['name'];
  iconProps?: IIconProps;
}

export function UnOrderedListItem({
  children,
  icon,
  iconProps,
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
      <Text pl="$2" tag="p" variant="$bodyLg">
        {children}
      </Text>
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
