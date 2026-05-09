import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

import type { SharedValue } from 'react-native-reanimated';

const DOT_HIT_AREA = 14;
const DOT_SIZE = 6;
const HIT_AREA_BORDER_WIDTH = 2;

interface IIndicatorDotProps {
  index: number;
  progress: SharedValue<number>;
  onPress: (index: number) => void;
}

function IndicatorDot({ index, progress, onPress }: IIndicatorDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(index - progress.value));
    const opacity = 1 - distance * 0.5;
    return { opacity };
  });

  return (
    <Stack
      width={DOT_HIT_AREA}
      height={DOT_HIT_AREA}
      alignItems="center"
      justifyContent="center"
      borderWidth={HIT_AREA_BORDER_WIDTH}
      borderColor="transparent"
      borderRadius={DOT_HIT_AREA / 2}
      hoverStyle={{ borderColor: 'rgba(255,255,255,0.3)' }}
      onPress={() => onPress(index)}
    >
      <Animated.View
        style={[
          {
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
          },
          animatedStyle,
        ]}
      />
    </Stack>
  );
}

interface IFeaturedIndicatorProps {
  count: number;
  progress: SharedValue<number>;
  onJump: (index: number) => void;
}

export function FeaturedIndicator({
  count,
  progress,
  onJump,
}: IFeaturedIndicatorProps) {
  if (count <= 1) return null;

  return (
    <Stack
      position="absolute"
      bottom={16}
      left={16}
      flexDirection="row"
      gap={8}
      zIndex={2}
    >
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <IndicatorDot key={i} index={i} progress={progress} onPress={onJump} />
      ))}
    </Stack>
  );
}
