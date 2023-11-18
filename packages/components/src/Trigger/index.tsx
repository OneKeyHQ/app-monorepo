import type { PropsWithChildren } from 'react';
import { Children, cloneElement, isValidElement } from 'react';

import { composeEventHandlers } from 'tamagui';

import { Button } from '../Button';
import { Stack } from '../Stack';

import type { IButtonProps } from '../Button';

export function Trigger({
  onOpen,
  children,
}: PropsWithChildren<{ onOpen?: () => void }>) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const handleOpen = (child.props as IButtonProps).onPress
        ? composeEventHandlers((child.props as IButtonProps).onPress, onOpen)
        : onOpen;
      if (child.type === Button) {
        return cloneElement(child, { onPress: handleOpen } as IButtonProps);
      }
      return <Stack onPress={handleOpen}>{children}</Stack>;
    }
  }
  return null;
}
