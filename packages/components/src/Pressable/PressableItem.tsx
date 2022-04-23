import React, { FC, useState } from 'react';

import { Pressable as NBPressable } from 'native-base';
import { autoHideSelectFunc } from '../utils/SelectAutoHide';

export type PressableItemProps = React.ComponentProps<typeof NBPressable>;

const PressableItem: FC<PressableItemProps> = ({ children, ...props }) => {
  const [isFocused, setFocused] = useState(false);
  const onPressOverride = React.useCallback(
    (e) => {
      // console.log('capture press');
      autoHideSelectFunc(e);
      props.onPress?.(e);
    },
    [props.onPress],
  );

  // TODO: use child function to check hover state
  return (
    <NBPressable
      px={{ base: '4', lg: '6' }}
      py={4}
      shadow="depth.2"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      _hover={{
        bg: 'surface-hovered',
        borderColor: isFocused ? '' : '',
      }}
      _focus={{
        bg: 'surface-hovered',
      }}
      _focusVisible={{
        bg: 'surface-hovered',
      }}
      _pressed={{
        bg: 'surface-pressed',
        borderColor: 'surface-pressed',
      }}
      bg="surface-default"
      {...props}
      onPress={onPressOverride}
    >
      {children}
    </NBPressable>
  );
};

export { PressableItem as default };
