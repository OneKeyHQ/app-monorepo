import { useEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '../../actions';

export function PaginationButton({
  direction,
  onPress,
  isVisible,
  onPointerEnter,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
  isVisible: boolean;
  onPointerEnter: () => void;
}) {
  const icon =
    direction === 'previous' ? 'ChevronLeftOutline' : 'ChevronRightOutline';
  const positionStyle = direction === 'previous' ? { left: 8 } : { right: 8 };

  const opacity = useSharedValue(isVisible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, { duration: 200 });
  }, [isVisible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      onPointerEnter={onPointerEnter}
      style={[
        animatedStyle,
        {
          display: isVisible ? 'flex' : 'none',
          position: 'absolute',
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          ...positionStyle,
        },
      ]}
    >
      <IconButton
        disabled={!isVisible}
        variant="primary"
        icon={icon}
        onPress={onPress}
      />
    </Animated.View>
  );
}
