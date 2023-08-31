import { forwardRef, memo } from 'react';

import { Button } from 'native-base';
// import { Button } from 'tamagui';

import { useBeforeOnPress } from '../utils/useBeforeOnPress';

import type { IButtonProps } from 'native-base';

const ButtonCapture = forwardRef<any, IButtonProps>(
  ({ onPress, ...props }, ref) => {
    const onPressOverride = useBeforeOnPress(onPress);
    return (
      <Button
        // @ts-ignore
        ref={ref}
        // {...props}
        onPressIn={props.onPressIn}
        onPress={onPressOverride}
      />
    );
  },
);
ButtonCapture.displayName = 'ButtonCapture';

export default memo(ButtonCapture);
