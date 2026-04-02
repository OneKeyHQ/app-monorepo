import { useCallback, useRef } from 'react';

import { Animated } from 'react-native';

import { IconButton } from '@onekeyhq/components';

interface IRefreshButtonProps {
  onRefresh: () => void;
}

function RefreshButton({ onRefresh }: IRefreshButtonProps) {
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
        size="medium"
        icon="RefreshCwOutline"
        onPress={handleRefresh}
        testID="browser-bar-refresh"
      />
    </Animated.View>
  );
}

export default RefreshButton;
