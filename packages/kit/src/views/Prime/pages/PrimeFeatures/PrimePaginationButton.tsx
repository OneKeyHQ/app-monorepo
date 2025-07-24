import { useEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '@onekeyhq/components';
import { useHoverOpacity } from '@onekeyhq/components/src/hooks/useHoverOpacity';

export function PaginationButton({
  direction,
  onPress,
  isVisible,
  isHovering,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
  isVisible: boolean;
  isHovering?: boolean;
}) {
  const icon =
    direction === 'previous'
      ? 'ChevronLeftSmallOutline'
      : 'ChevronRightSmallOutline';
  const positionStyle = direction === 'previous' ? { left: 16 } : { right: 16 };

  const opacity = useSharedValue(isVisible ? 1 : 0);
  const hoverOpacity = useHoverOpacity(isHovering);

  useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, { duration: 250 });
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
      <IconButton
        disabled={!isVisible}
        variant="tertiary"
        icon={icon}
        onPress={onPress}
        iconProps={hoverOpacity}
        theme="dark"
      />
    </Animated.View>
  );
}
