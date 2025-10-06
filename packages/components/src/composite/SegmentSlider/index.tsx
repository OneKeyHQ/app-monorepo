import { StyleSheet, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { TextStyle, ViewStyle } from 'react-native';
import type { SliderThemeType } from 'react-native-awesome-slider';
import type { SharedValue } from 'react-native-reanimated';

const sliderHeight = 8;

const COLORS = {
  backgroundColor: '#0A0A0A',
  inputBackgroundColor: '#1f1f1f',

  borderColor: '#474747',
  markColor: '#EAECEF',

  bubbleBackgroundColor: '#E0E2E5',
  bubbleTextColor: '#262C36',

  textColor: '#EAECEF',
  descriptionColor: '#E0E2E5',
  cardStyle: {
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#292929',
    gap: 8,
    backgroundColor: '#0a0a0a',
  } satisfies ViewStyle,

  optionStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
  } satisfies ViewStyle,
  optionTextStyle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EAECEF',
  } satisfies TextStyle,
  sliderTheme: {
    maximumTrackTintColor: '#292929',
    minimumTrackTintColor: '#EAECEF',
    bubbleBackgroundColor: '#E0E2E5',
    bubbleTextColor: '#262C36',
    cacheTrackTintColor: 'rgba(189, 186, 186, 0.6)',
  } satisfies SliderThemeType,
};

const styles = StyleSheet.create({
  slider: {
    marginBottom: 20,
    marginTop: 12,
  },
  containerStyle: {
    overflow: 'hidden',
    borderRadius: 999,
  },
  mark: {
    width: 2,
    height: sliderHeight,
  },
  track: {
    height: '100%',
    width: '100%',
  },
});

const colors = [
  '#FF4B4B',
  '#FF764B',
  '#FFA14B',
  '#FFD24B',
  '#FFE74B',
  '#E9FF4B',
  '#BFFF4B',
  '#89FF4B',
  '#4BFF62',
  '#4BFFA1',
];
const TrackSegment = ({
  index,
  progress,
  step,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  step: number;
  color: string | undefined;
}) => {
  const style = useAnimatedStyle(() => {
    const progressStep = Math.round((progress.value / 100) * step);
    return {
      opacity: index < progressStep ? 1 : 0,
    };
  });
  return (
    <View
      style={[
        styles.track,
        {
          borderTopLeftRadius: index === 0 ? 999 : 0,
          borderBottomLeftRadius: index === 0 ? 999 : 0,
          borderTopRightRadius: index === step - 1 ? 999 : 0,
          borderBottomRightRadius: index === step - 1 ? 999 : 0,
          overflow: 'hidden',
        },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, style]}>
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: color }]}
        />
      </Animated.View>
    </View>
  );
};

const step = colors.length - 1;

export function SegmentSlider() {
  const progress = useSharedValue(50);
  const min = useSharedValue(0);
  const max = useSharedValue(100);

  return (
    <Slider
      progress={progress}
      minimumValue={min}
      style={styles.slider}
      containerStyle={styles.containerStyle}
      maximumValue={max}
      steps={step}
      sliderHeight={sliderHeight}
      renderBubble={() => <></>}
      renderMark={({ index }) => {
        if (index === 0 || index === step) return null;
        return (
          <View
            style={[
              styles.mark,
              {
                backgroundColor: COLORS.markColor,
              },
            ]}
          />
        );
      }}
      renderTrack={({ index }) => {
        return (
          <TrackSegment
            index={index}
            progress={progress}
            step={step}
            color={colors[index]}
          />
        );
      }}
      forceSnapToStep
      thumbWidth={20}
      theme={{
        ...COLORS.sliderTheme,
      }}
    />
  );
}
