import { forwardRef, useCallback } from 'react';

import { Button } from 'native-base';

import { autoHideSelectFunc } from '../utils/SelectAutoHide';

import type { IButtonProps } from 'native-base';

const ButtonCapture = forwardRef<typeof Button, IButtonProps>(
  ({ onPress, ...props }, ref) => {
    const onPressOverride = useCallback(
      (e) => {
        autoHideSelectFunc(e);
        onPress?.(e);
      },
      [onPress],
    );
    return (
      <Button
        // @ts-expect-error
        ref={ref}
        {...props}
        onPress={onPressOverride}
      />
    );
  },
);
ButtonCapture.displayName = 'ButtonCapture';

export default ButtonCapture;
