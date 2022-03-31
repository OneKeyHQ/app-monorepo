import React, { ComponentProps, FC, useCallback } from 'react';

import { Pressable, View } from 'native-base';
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

  // DESKTOP OR WEB
  if (Platform.OS === 'web') {
    return (
      <View w="full" h="full">
        {children}
      </View>
    );
  }
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
