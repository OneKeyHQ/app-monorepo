import React, { FC } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import { useProviderValue } from '../Provider/hooks';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = React.ComponentProps<typeof NBPressable>;

const PressableCapture: FC<PressableItemProps> = ({ onPress, ...props }) => {
  const { hapticsEnabled } = useProviderValue();
  const onPressOverride = React.useCallback(
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
      {...props}
      onPress={props.disabled ? null : onPressOverride}
      cursor={props.disabled ? 'not-allowed' : 'pointer'}
    />
  );
};

export { PressableCapture as default };
