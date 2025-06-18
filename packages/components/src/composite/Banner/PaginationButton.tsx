import { useEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton, type IIconButtonProps } from '../../actions';
import { useHoverOpacity } from '../../hooks/useHoverOpacity';

export function PaginationButton({
  direction,
  onPress,
  isVisible,
  isHovering,
  theme,
  variant = 'secondary',
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
  isVisible: boolean;
  isHovering?: boolean;
  theme?: 'light' | 'dark';
  variant?: IIconButtonProps['variant'];
}) {
  const icon =
    direction === 'previous' ? 'ChevronLeftOutline' : 'ChevronRightOutline';
  const positionStyle = direction === 'previous' ? { left: 8 } : { right: 8 };
  const hoverOpacity = useHoverOpacity(isHovering);

  const opacity = useSharedValue(isVisible ? 1 : 0);

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
        variant={variant}
        icon={icon}
        onPress={onPress}
        iconProps={hoverOpacity}
        theme={theme}
      />
    </Animated.View>
  );
}
