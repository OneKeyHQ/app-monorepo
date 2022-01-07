import React, { ComponentProps, FC, useCallback } from 'react';

import { Pressable } from 'native-base';
import { Keyboard, Platform } from 'react-native';

export const KeyboardDismissView: FC<ComponentProps<typeof Pressable>> = ({
  children,
  ...props
}) => {
  const onPress = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Keyboard.dismiss();
    }
  }, []);
  return (
    <Pressable flex="1" w="full" h="full" {...props} onPress={onPress}>
      {children}
    </Pressable>
  );
};

export default KeyboardDismissView;
