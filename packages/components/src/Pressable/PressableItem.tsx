import type { ComponentProps } from 'react';
import { forwardRef, useCallback } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import useProviderValue from '../Provider/hooks/useProviderValue';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = ComponentProps<typeof NBPressable>;

const PressableItem = forwardRef<typeof NBPressable, PressableItemProps>(
  ({ children, onPress, ...props }, ref) => {
    const { hapticsEnabled } = useProviderValue();
    const onPressOverride = useCallback(
      (e) => {
        if (hapticsEnabled && onPress) {
          enableHaptics();
        }
        autoHideSelectFunc(e);
        onPress?.(e);
      },
      [onPress, hapticsEnabled],
    );

    // TODO: use child function to check hover state
    return (
      <NBPressable
        ref={ref}
        px={{ base: '4', lg: '6' }}
        py={4}
        _hover={{
          bg: 'surface-hovered',
        }}
        _focus={{
          bg: 'surface-hovered',
        }}
        _focusVisible={{
          bg: 'surface-hovered',
        }}
        _pressed={{
          bg: 'surface-pressed',
          borderColor: 'surface-pressed',
        }}
        bg="surface-default"
        {...props}
        onPress={onPressOverride}
      >
        {children}
      </NBPressable>
    );
  },
);
PressableItem.displayName = 'PressableItem';

export default PressableItem;
