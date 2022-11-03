import { ComponentProps, FC, useCallback } from 'react';

import { Keyboard } from 'react-native';

import Pressable from '../Pressable';

const KeyboardDismissView: FC<ComponentProps<typeof Pressable>> = ({
  children,
  ...props
}) => {
  const onPress = useCallback(() => {
    Keyboard.dismiss();
  }, []);
  return (
    <Pressable
      w="full"
      h="full"
      _focusVisible={{ outlineWidth: 0 }}
      {...props}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
};

export default KeyboardDismissView;
