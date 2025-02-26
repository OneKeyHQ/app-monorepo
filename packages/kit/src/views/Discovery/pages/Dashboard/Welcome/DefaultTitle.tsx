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

  useEffect(() => {
    // Start fade-in animation when component mounts
    opacity.value = withTiming(1, { duration: 800 });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
