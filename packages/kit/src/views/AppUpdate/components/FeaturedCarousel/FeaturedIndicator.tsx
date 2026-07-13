import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

import type { SharedValue } from 'react-native-reanimated';

const DOT_HEIGHT = 6;
const DOT_INACTIVE_WIDTH = 6;
const DOT_ACTIVE_WIDTH = 18;
const HIT_AREA_HEIGHT = 14;
const HIT_AREA_BORDER_WIDTH = 2;
const HIT_AREA_PADDING_X = 3;

interface IIndicatorDotProps {
  index: number;
  progress: SharedValue<number>;
  onPress: (index: number) => void;
}

function IndicatorDot({ index, progress, onPress }: IIndicatorDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(index - progress.value));
    // Pill-shaped active dot, round inactive dot. Width interpolates with
    // distance so the transition mirrors the carousel's slide motion.
    const width =
      DOT_INACTIVE_WIDTH +
      (DOT_ACTIVE_WIDTH - DOT_INACTIVE_WIDTH) * (1 - distance);
    const opacity = 1 - distance * 0.5;
    return { width, opacity };
  });

  return (
    <Stack
      height={HIT_AREA_HEIGHT}
      paddingHorizontal={HIT_AREA_PADDING_X}
      alignItems="center"
      justifyContent="center"
      borderWidth={HIT_AREA_BORDER_WIDTH}
      borderColor="transparent"
      borderRadius={HIT_AREA_HEIGHT / 2}
      hoverStyle={{ borderColor: 'rgba(255,255,255,0.3)' }}
      onPress={() => onPress(index)}
    >
      <Animated.View
        style={[
          {
            height: DOT_HEIGHT,
            borderRadius: DOT_HEIGHT / 2,
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
      gap={4}
      zIndex={2}
    >
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <IndicatorDot key={i} index={i} progress={progress} onPress={onJump} />
      ))}
    </Stack>
  );
}
