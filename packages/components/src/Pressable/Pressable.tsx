import React, { FC } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = React.ComponentProps<typeof NBPressable>;

const PressableCapture: FC<PressableItemProps> = ({ onPress, ...props }) => {
  const onPressOverride = React.useCallback(
    (e) => {
      autoHideSelectFunc(e);
      onPress?.(e);
    },
    [onPress],
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
