import type { ComponentProps } from 'react';
import { forwardRef, memo } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { useBeforeOnPress } from '../utils/useBeforeOnPress';

export type PressableItemProps = ComponentProps<typeof NBPressable>;

const PressableCapture = forwardRef<typeof NBPressable, PressableItemProps>(
  ({ onPress, ...props }: PressableItemProps, ref) => {
    const onPressOverride = useBeforeOnPress(onPress);

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

export default memo(PressableCapture);
