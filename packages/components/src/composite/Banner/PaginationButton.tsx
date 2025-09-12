import { useEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { type IIconButtonProps, IconButton } from '../../actions';
import { useHoverOpacity } from '../../hooks/useHoverOpacity';

export function PaginationButton({
  direction,
  onPress,
  isVisible,
  isHovering,
  theme,
  variant = 'secondary',
  iconSize = 'default',
  positionOffset = 8,
  zIndex,
  onMouseEnter,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
  isVisible: boolean;
  isHovering?: boolean;
  theme?: 'light' | 'dark';
  variant?: IIconButtonProps['variant'];
  iconSize?: 'default' | 'small';
  positionOffset?: number;
  zIndex?: number;
  onMouseEnter?: () => void;
}) {
  const smallIcon =
    direction === 'previous'
      ? 'ChevronLeftSmallOutline'
      : 'ChevronRightSmallOutline';
  const defaultIcon =
    direction === 'previous' ? 'ChevronLeftOutline' : 'ChevronRightOutline';
  const icon = iconSize === 'small' ? smallIcon : defaultIcon;
  const positionStyle =
    direction === 'previous'
      ? { left: positionOffset }
      : { right: positionOffset };
  const hoverOpacity = useHoverOpacity(isHovering);

  const opacity = useSharedValue(isVisible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, { duration: 50 });
  }, [isVisible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        animatedStyle,
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          ...positionStyle,
          zIndex,
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
        onMouseEnter={onMouseEnter}
      />
    </Animated.View>
  );
}
