import { useCallback, useRef } from 'react';

import { Animated } from 'react-native';

import { IconButton } from '@onekeyhq/components';

import { DiscoveryTestIDs } from '../../testIDs';

interface IRefreshButtonProps {
  onRefresh: () => void;
  size?: 'small' | 'medium' | 'large';
}

function RefreshButton({ onRefresh, size = 'medium' }: IRefreshButtonProps) {
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
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <IconButton
        variant="tertiary"
        size={size}
        icon="RefreshCwOutline"
        onPress={handleRefresh}
        testID={DiscoveryTestIDs.browserRefreshButton}
      />
    </Animated.View>
  );
}

export default RefreshButton;
