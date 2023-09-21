import type { ComponentPropsWithoutRef, FC } from 'react';
import { useCallback, useRef } from 'react';

import { type GestureResponderEvent } from 'react-native';

import { Pressable as PressableOrigin } from '@onekeyhq/components';

type Props = ComponentPropsWithoutRef<typeof PressableOrigin>;

export const Pressable: FC<Props> = ({ onPress, ...rest }) => {
  // eslint-disable-next-line
    const ref = useRef<any>()
  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      // eslint-disable-next-line
        ref.current?.blur?.()
      onPress?.(e);
    },
    [onPress],
  );
  return <PressableOrigin ref={ref} {...rest} onPress={handlePress} />;
};
