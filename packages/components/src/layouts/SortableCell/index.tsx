import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';

import {
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import { AnimatePresence } from 'tamagui';

import { IconButton } from '../../actions/IconButton';
import { Stack, XStack } from '../../primitives/Stack';

import type { StackProps } from '@tamagui/web/types/types';
import type { PressableProps, View } from 'react-native';
import type { GetProps, TamaguiElement } from 'tamagui';

export type ISortableCellProps = StackProps & {
  isEditing?: boolean;
  shadowProps?: Omit<GetProps<typeof ShadowDecorator>, 'children'>;
  scaleProps?: Omit<GetProps<typeof ScaleDecorator>, 'children'>;
  pressableProps?: Omit<PressableProps, 'children'>;
  drag: () => void;
  isActive: boolean;
  onDeletePress?: () => void;
};

export type ISortableCellRef = View;

function BaseSortableCell(
  {
    isEditing = false,
    drag,
    isActive,
    shadowProps = {},
    scaleProps = { activeScale: 0.9 },
    onDeletePress,
    ...rest
  }: ISortableCellProps,
  ref: ForwardedRef<TamaguiElement> | undefined,
) {
  return (
    <ShadowDecorator {...shadowProps}>
      <ScaleDecorator {...scaleProps}>
        <XStack w="100%" alignItems="center">
          <AnimatePresence exitBeforeEnter>
            {isEditing && (
              <IconButton
                onPress={onDeletePress}
                icon="MinusCircleSolid"
                variant="destructive"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  scale: 0,
                }}
              />
            )}
          </AnimatePresence>

          <Stack ref={ref} flex={1} {...rest} />

          {/* Don't use `Stack.onLongPress` as it will only be called after `onPressOut` */}
          <AnimatePresence exitBeforeEnter>
            {isEditing && (
              <IconButton
                icon="MenuOutline"
                onPressIn={drag}
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  scale: 0,
                }}
              />
            )}
          </AnimatePresence>
        </XStack>
      </ScaleDecorator>
    </ShadowDecorator>
  );
}

export const SortableCell = forwardRef(
  BaseSortableCell,
) as typeof BaseSortableCell;
