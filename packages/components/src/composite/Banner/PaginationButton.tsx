import { useEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '../../actions';
import { Stack } from '../../primitives';

export function PaginationButton({
  direction,
  onPress,
  isVisible,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
  isVisible: boolean;
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
      style={[
        animatedStyle,
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          ...positionStyle,
        },
      ]}
    >
      <Stack borderRadius="$full" bg="$whiteA12">
        <IconButton icon={icon} onPress={onPress} />
      </Stack>
    </Animated.View>
  );
}
