import React, { FC, useState } from 'react';

import { Pressable as NBPressable } from 'native-base';

export type PressableItemProps = React.ComponentProps<typeof NBPressable>;

const PressableItem: FC<PressableItemProps> = ({ children, ...props }) => {
  const [isFocused, setFocused] = useState(false);

  return (
    <NBPressable
      px={{ base: '4', lg: '6' }}
      py={4}
      shadow="depth.2"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      _hover={{
        bg: 'surface-hovered',
        borderColor: isFocused ? 'focused-default' : 'surface-hovered',
      }}
      _focus={{
        bg: 'surface-hovered',
        borderColor: 'focused-default',
      }}
      _focusVisible={{
        bg: 'surface-hovered',
        borderColor: 'focused-default',
      }}
      _pressed={{
        bg: 'surface-selected',
        borderColor: 'surface-selected',
      }}
      bg="surface-default"
      borderWidth="2px"
      borderColor="surface-default"
      {...props}
    >
      {children}
    </NBPressable>
  );
};

export { PressableItem as default };
