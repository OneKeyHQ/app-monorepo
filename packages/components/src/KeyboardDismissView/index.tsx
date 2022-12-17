import type { ComponentProps, FC } from 'react';

import { Keyboard } from 'react-native';

import Pressable from '../Pressable';

const onPress = () => {
  Keyboard.dismiss();
};
const KeyboardDismissView: FC<ComponentProps<typeof Pressable>> = ({
  children,
  ...props
}) => (
  <Pressable w="full" h="full" {...props} onPress={onPress}>
    {children}
  </Pressable>
);

export default KeyboardDismissView;
