import React, { FC } from 'react';

import { Button } from 'native-base';
import type { IButtonProps } from 'native-base';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';


const ButtonCapture: FC<IButtonProps> = (props) => {
  const onPressOverride = React.useCallback(
    (e) => {
      // console.log('capture press');
      autoHideSelectFunc(e);
      props.onPress?.(e);
    },
    [props.onPress],
  );
  return (
    <Button
      {...props}
      onPress={onPressOverride}
    />
  );
};

export { ButtonCapture as default };
