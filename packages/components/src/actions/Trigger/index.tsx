import type { ForwardedRef, PropsWithChildren } from 'react';
import { Children, cloneElement, forwardRef, isValidElement } from 'react';

import { Stack } from '../../primitives';
import { Button } from '../../primitives/Button';
import { IconButton } from '../IconButton';

import type { IButtonProps } from '../../primitives/Button';
import type { View as IView } from 'react-native';

const composeEventHandlers =
  (
    onPress: (...params: any) => void | Promise<boolean>,
    onTrigger?: () => void,
  ) =>
  async (...params: any) => {
    const result = await onPress(...params);
    if (result !== false) {
      onTrigger?.();
    }
  };

function BasicTrigger(
  {
    onPress: onPressInTrigger,
    children,
  }: PropsWithChildren<{ onPress?: () => void }>,
  ref: ForwardedRef<IView>,
) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const { onPress, ...props } = child.props as IButtonProps;
      const handleOpen = onPress
        ? composeEventHandlers(onPress, onPressInTrigger)
        : onPressInTrigger;
      if ([Button, IconButton].includes(child.type as any)) {
        return cloneElement(child, {
          onPress: handleOpen,
          ...props,
          ref,
        } as IButtonProps);
      }
      return (
        <Stack ref={ref} onPress={handleOpen}>
          {children}
        </Stack>
      );
    }
  }
  return null;
}

export const Trigger = forwardRef(BasicTrigger);
