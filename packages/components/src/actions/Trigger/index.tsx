import type { ForwardedRef, PropsWithChildren } from 'react';
import { Children, cloneElement, forwardRef, isValidElement } from 'react';

import { debounce } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

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

type ITrigger = PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>;
const noop = () => undefined;

const stopPropagationPress = (onPress: (...params: any[]) => void) =>
  platformEnv.isRuntimeBrowser
    ? (...params: any[]) => {
        const event = params[0];
        if (event && 'stopPropagation' in event) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          event.stopPropagation();
        }
        return onPress(...params);
      }
    : onPress;

function BasicTrigger(
  { onPress: onPressInTrigger, disabled, children }: ITrigger,
  ref: ForwardedRef<IView>,
) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const { onPress, ...props } = child.props as IButtonProps;
      const handleOpen = onPress
        ? composeEventHandlers(onPress, onPressInTrigger)
        : onPressInTrigger;
      const debounceHandlePress = stopPropagationPress(
        debounce(handleOpen as () => void, 10),
      );
      const handlePressWithStatus = disabled ? noop : debounceHandlePress;

      return (
        <Stack ref={ref} onPress={handlePressWithStatus}>
          {cloneElement(child, {
            onPress: handlePressWithStatus,
            ...props,
          } as IButtonProps)}
        </Stack>
      );
    }
  }
  return null;
}

export const Trigger = forwardRef(BasicTrigger);
