/* eslint-disable no-nested-ternary */
import type { ComponentProps, FC } from 'react';

import { HStack, Pressable } from '@onekeyhq/components';

import Column from './Column';

import type { ColorType } from 'native-base/lib/typescript/components/types';

type ListItemProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  pressedBgColor?: ColorType;
  hoveredBgColor?: ColorType;
} & ComponentProps<typeof HStack>;

const ListItem: FC<ListItemProps> = ({
  onLongPress,
  onPress,
  pressedBgColor,
  hoveredBgColor,
  bgColor,
  children,
  ...rest
}) =>
  onPress ? (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {({ isHovered, isPressed }) => (
        <HStack
          px={2}
          py={1.5}
          my={0.5}
          space={3}
          alignItems="center"
          borderRadius="xl"
          bgColor={
            isPressed
              ? pressedBgColor ?? 'surface-pressed'
              : isHovered
              ? hoveredBgColor ?? 'surface-hovered'
              : bgColor ?? undefined
          }
          {...rest}
        >
          {children}
        </HStack>
      )}
    </Pressable>
  ) : (
    <HStack alignItems="center" p={2} space={3} {...rest}>
      {children}
    </HStack>
  );
// @ts-ignore
ListItem.Column = Column;

export default ListItem as typeof ListItem & { Column: typeof Column };
