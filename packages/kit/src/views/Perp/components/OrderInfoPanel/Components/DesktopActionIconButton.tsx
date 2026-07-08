import { memo } from 'react';

import { Icon, XStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';

import type { GestureResponderEvent } from 'react-native';

type IDesktopActionIconButtonProps = {
  testID: string;
  icon: IKeyOfIcons;
  iconSize?: '$3' | '$3.5' | '$4';
  size?: 'small' | 'medium';
  onPress?: (event?: GestureResponderEvent) => void;
};

export const DesktopActionIconButton = memo(
  ({
    testID,
    icon,
    iconSize = '$4',
    size = 'medium',
    onPress,
  }: IDesktopActionIconButtonProps) => {
    return (
      <XStack
        testID={testID}
        p={size === 'small' ? '$1' : '$1.5'}
        m={size === 'small' ? -5 : -7}
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        bg="transparent"
        group
        hoverStyle={{ bg: 'transparent' }}
        pressStyle={{ bg: 'transparent' }}
        onPress={onPress}
      >
        <Icon
          name={icon}
          size={iconSize}
          color="$iconSubdued"
          $group-hover={{ color: '$icon' }}
          $group-press={{ color: '$iconActive' }}
        />
      </XStack>
    );
  },
);

DesktopActionIconButton.displayName = 'DesktopActionIconButton';
