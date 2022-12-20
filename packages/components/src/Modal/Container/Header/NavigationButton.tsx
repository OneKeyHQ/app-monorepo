import type { ComponentProps, FC } from 'react';

import { StyleSheet } from 'react-native';

import Icon from '../../../Icon';
import Pressable from '../../../Pressable';

export interface NavigationButtonProps
  extends ComponentProps<typeof Pressable> {
  back?: boolean;
  onPress?: () => void;
}

const NavigationButton: FC<NavigationButtonProps> = ({
  back,
  onPress,
  ...rest
}) => (
  <Pressable
    onPress={onPress}
    p="4px"
    rounded="full"
    hitSlop={8}
    borderWidth={StyleSheet.hairlineWidth}
    borderColor="border-default"
    bgColor="action-secondary-default"
    _hover={{ bgColor: 'action-secondary-hovered' }}
    _pressed={{ bgColor: 'action-secondary-pressed' }}
    {...rest}
  >
    <Icon
      size={20}
      name={back ? 'ArrowLeftMini' : 'XMarkMini'}
      color="icon-subdued"
    />
  </Pressable>
);

export default NavigationButton;
