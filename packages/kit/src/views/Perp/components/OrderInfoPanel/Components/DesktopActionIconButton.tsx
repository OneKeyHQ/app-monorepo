import { memo, useState } from 'react';

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
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    let iconColor: '$iconActive' | '$icon' | '$iconSubdued' = '$iconSubdued';
    if (isPressed) {
      iconColor = '$iconActive';
    } else if (isHovered) {
      iconColor = '$icon';
    }

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
        hoverStyle={{ bg: 'transparent' }}
        pressStyle={{ bg: 'transparent' }}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        onPress={onPress}
      >
        <Icon name={icon} size={iconSize} color={iconColor} />
      </XStack>
    );
  },
);

DesktopActionIconButton.displayName = 'DesktopActionIconButton';
