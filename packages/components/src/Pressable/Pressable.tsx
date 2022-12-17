import type { ComponentProps } from 'react';
import { forwardRef, useCallback } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import { useProviderValue } from '../Provider/hooks';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = ComponentProps<typeof NBPressable>;

const PressableCapture = forwardRef<typeof NBPressable, PressableItemProps>(
  ({ onPress, ...props }: PressableItemProps, ref) => {
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

    return (
      <NBPressable
        ref={ref}
        {...props}
        onPress={props.disabled ? null : onPressOverride}
        // @ts-ignore
        cursor={props.disabled ? 'not-allowed' : 'pointer'}
      />
    );
  },
);

PressableCapture.displayName = 'Pressable';

export default PressableCapture;
