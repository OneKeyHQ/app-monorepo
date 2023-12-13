import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';

import { Pressable } from 'react-native';
import {
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';

import type { CellRendererProps, PressableProps, View } from 'react-native';
import type { GetProps } from 'tamagui';

export type ISortableCellContainerProps<T> = Omit<
  CellRendererProps<T>,
  'cellKey' | 'index' | 'style'
> &
  PressableProps & {
    shadowProps?: Omit<GetProps<typeof ShadowDecorator>, 'children'>;
    scaleProps?: Omit<GetProps<typeof ScaleDecorator>, 'children'>;
    getIndex: () => number | undefined;
    drag: () => void;
    isActive: boolean;
  };

export type ISortableCellContainerRef = View;

function BaseSortableCellContainer<T>(
  {
    drag,
    isActive,
    shadowProps = {},
    scaleProps = { activeScale: 0.9 },
    ...rest
  }: ISortableCellContainerProps<T>,
  ref: ForwardedRef<View> | undefined,
) {
  return (
    <ShadowDecorator {...shadowProps}>
      <ScaleDecorator {...scaleProps}>
        {/* Don't use `Stack.onLongPress` as it will only be called after `onPressOut` */}
        <Pressable ref={ref} onLongPress={drag} disabled={isActive} {...rest} />
      </ScaleDecorator>
    </ShadowDecorator>
  );
}

export const SortableCellContainer = forwardRef(
  BaseSortableCellContainer,
) as typeof BaseSortableCellContainer;
