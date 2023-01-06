import { forwardRef, useCallback } from 'react';

import { Button } from 'native-base';

import { beforeOnPress } from '../utils/beforeOnPress';

import type { IButtonProps } from 'native-base';

const ButtonCapture = forwardRef<any, IButtonProps>(
  ({ onPress, ...props }, ref) => {
    const onPressOverride = useCallback(
      (e) => {
        beforeOnPress(e, onPress);
      },
      [onPress],
    );
    return (
      <Button
        // @ts-ignore
        ref={ref}
        {...props}
        onPress={onPressOverride}
      />
    );
  },
);
ButtonCapture.displayName = 'ButtonCapture';

export default ButtonCapture;
