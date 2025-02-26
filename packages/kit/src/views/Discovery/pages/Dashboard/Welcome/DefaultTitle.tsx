// Let's Dive in
import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SizableText } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export const DefaultTitle = () => {
  const intl = useIntl();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10); // Start 10 pixels down

  useEffect(() => {
    // Delay animation start by 300ms
    const timer = setTimeout(() => {
      // Start fade-in animation after delay
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 400 }); // Move to original position (0)
    }, 300);

    // Clean up timer on unmount
    return () => clearTimeout(timer);
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <SizableText
        color="$text"
        size="$heading2xl"
        fontWeight="bold"
        textAlign="center"
      >
        {intl.formatMessage({ id: ETranslations.browser_dive_in })}
      </SizableText>
    </Animated.View>
  );
};
