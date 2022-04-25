import React, { ComponentProps, FC, useCallback } from 'react';

import { View } from 'native-base';
import { Keyboard } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Pressable from '../Pressable';

export const KeyboardDismissView: FC<ComponentProps<typeof Pressable>> = ({
  children,
  ...props
}) => {
  const onPress = useCallback(() => {
    if (platformEnv.isNative) {
      Keyboard.dismiss();
    }
  }, []);

  // DESKTOP OR WEB
  if (platformEnv.isWeb) {
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
