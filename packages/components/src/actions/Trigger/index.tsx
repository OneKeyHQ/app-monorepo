import type { ForwardedRef, PropsWithChildren } from 'react';
import {
  Children,
  Fragment,
  cloneElement,
  forwardRef,
  isValidElement,
} from 'react';

import { debounce } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import type { IButtonProps } from '../../primitives/Button';
import type { View as IView, LayoutChangeEvent } from 'react-native';

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

type ITrigger = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}>;
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
  { onPress: onPressInTrigger, disabled, children, onLayout }: ITrigger,
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

      // Check if child is Fragment to avoid adding onPress to it
      const isFragment = child.type === Fragment;
      const childProps = isFragment
        ? {
            // Invalid prop `disabled` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.
            key: child.key,
            children: props.children,
          }
        : { onPress: handlePressWithStatus, disabled, ...props };

      return (
        <Stack ref={ref} onLayout={onLayout} onPress={handlePressWithStatus}>
          {cloneElement(child, childProps as IButtonProps)}
        </Stack>
      );
    }
  }
  return null;
}

export const Trigger = forwardRef(BasicTrigger);
