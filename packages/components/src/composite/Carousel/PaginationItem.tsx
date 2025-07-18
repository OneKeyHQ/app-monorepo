import type { PropsWithChildren } from 'react';

import { TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import type { ViewStyle } from 'react-native';

export type IDotStyle = Omit<ViewStyle, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

export type IPaginationItemProps<T> = PropsWithChildren<{
  index: number;
  count: number;
  size?: number;
  animValue: Animated.SharedValue<number>;
  horizontal?: boolean;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  onPress: () => void;
}>;

export function PaginationItem<T>({
  index,
  count,
  size,
  animValue,
  horizontal,
  dotStyle,
  activeDotStyle,
  onPress,
  children,
}: IPaginationItemProps<T>) {
  const defaultDotSize = 10;

  const sizes = {
    width: size || dotStyle?.width || defaultDotSize,
    height: size || dotStyle?.height || defaultDotSize,
  };

  /**
   * TODO: Keep this for future implementation
   * Used to change the size of the active dot with animation
   */
  // const animatedSize = {
  //   width: activeDotStyle?.width,
  //   height: activeDotStyle?.height,
  // };

  const width = sizes.width;
  const height = sizes.height;

  const animStyle = useAnimatedStyle(() => {
    const sizeValue = horizontal ? height : width;
    let inputRange = [index - 1, index, index + 1];
    let outputRange = [-sizeValue, 0, sizeValue];

    if (index === 0 && animValue?.value > count - 1) {
      inputRange = [count - 1, count, count + 1];
      outputRange = [-sizeValue, 0, sizeValue];
    }

    return {
      transform: [
        {
          translateX: interpolate(
            animValue?.value,
            inputRange,
            outputRange,
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [animValue, index, count, horizontal]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        style={[
          {
            width,
            height,
            overflow: 'hidden',
            transform: [
              {
                rotateZ: horizontal ? '90deg' : '0deg',
              },
            ],
          },
          dotStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              backgroundColor: 'black',
              flex: 1,
            },
            animStyle,
            activeDotStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}
