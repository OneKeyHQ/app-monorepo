import React, { FC } from 'react';

import { Pressable as NBPressable } from 'native-base';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = React.ComponentProps<typeof NBPressable>;

const PressableCapture: FC<PressableItemProps> = (props) => {
  const onPressOverride = React.useCallback(
    (e) => {
      // console.log('capture press');
      autoHideSelectFunc(e);
      props.onPress?.(e);
    },
    [props.onPress],
  );
  return (
    <NBPressable
      {...props}
      onPress={onPressOverride}
    />
  );
};

export { PressableCapture as default };
