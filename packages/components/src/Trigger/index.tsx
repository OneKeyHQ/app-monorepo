import type { ForwardedRef, PropsWithChildren } from 'react';
import { Children, cloneElement, forwardRef, isValidElement } from 'react';

import { composeEventHandlers } from 'tamagui';

import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Stack } from '../Stack';

import type { IButtonProps } from '../Button';
import type { View as IView } from 'react-native';

function BasicTrigger(
  { onOpen, children }: PropsWithChildren<{ onOpen?: () => void }>,
  ref: ForwardedRef<IView>,
) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const { onPress, ...props } = child.props as IButtonProps;
      const handleOpen = onPress
        ? composeEventHandlers(onPress, onOpen)
        : onOpen;
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
