import { useEffect } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    zIndex: 10,
  },
});

// Thin page-load bar. The WebView reports progress in coarse steps (e.g. 10,
// 50, 90), so the bar glides between them instead of jumping, and fades out
// once the page finishes instead of vanishing mid-fill.
function BrowserLoadingBar({ progress }: { progress: number }) {
  const width = useSharedValue(progress);
  const opacity = useSharedValue(progress < 100 ? 1 : 0);

  useEffect(() => {
    if (progress < width.value) {
      // A new navigation restarted the load: jump back, no backwards glide.
      width.value = progress;
    } else {
      width.value = withTiming(progress, { duration: 250 });
    }
    opacity.value =
      progress < 100 ? 1 : withDelay(150, withTiming(0, { duration: 200 }));
  }, [progress, width, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.bar, animatedStyle]}>
      <Stack flex={1} bg="$bgPrimary" />
    </Animated.View>
  );
}

export default BrowserLoadingBar;
