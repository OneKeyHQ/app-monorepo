import { useCallback, useRef } from 'react';

import { Animated } from 'react-native';

import { IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';

import { DiscoveryTestIDs } from '../../testIDs';

import { ChromePressable } from './ChromePressable';

interface IRefreshButtonProps {
  onRefresh: () => void;
  size?: 'small' | 'medium' | 'large';
  iconSize?: IIconButtonProps['iconSize'];
}

function RefreshButton({
  onRefresh,
  size = 'medium',
  iconSize,
}: IRefreshButtonProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handleRefresh = useCallback(() => {
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      rotateAnim.setValue(0);
    });
    onRefresh();
  }, [onRefresh, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ChromePressable onPress={handleRefresh}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <IconButton
          variant="tertiary"
          size={size}
          icon="RefreshCwOutline"
          iconSize={iconSize}
          testID={DiscoveryTestIDs.browserRefreshButton}
        />
      </Animated.View>
    </ChromePressable>
  );
}

export default RefreshButton;
