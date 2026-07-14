import { memo } from 'react';

import { IconButton } from '@onekeyhq/components';
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
      <IconButton
        testID={testID}
        size={size}
        variant="tertiary"
        icon={icon}
        iconSize={iconSize}
        iconProps={{
          color: '$iconSubdued',
          hoverStyle: { color: '$icon' },
          pressStyle: { color: '$iconActive' },
        }}
        hoverStyle={{ bg: 'transparent' }}
        pressStyle={{ bg: 'transparent' }}
        onPress={onPress}
        hotKey
      />
    );
  },
);

DesktopActionIconButton.displayName = 'DesktopActionIconButton';
