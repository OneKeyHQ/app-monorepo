import { StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollView } from '@onekeyhq/components';

import {
  BACK_BUTTON_HEIGHT,
  CARDS,
  CARD_HEIGHT_CLOSED,
  CARD_MARGIN,
} from './assets/config';
import { theme } from './assets/theme';
import { BackButton } from './components/BackButton';
import Card from './components/Card';
import SwipeGesture from './components/SwipeGesture';
import { metrics } from './constants/metrics';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
  },
  backButton: {
    height: BACK_BUTTON_HEIGHT,
    width: BACK_BUTTON_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 17,
  },
});

// Example taken from https://github.com/mxm87/rnui/tree/master/src/screens/apple-wallet-screen
const AppleWalletScreen = () => {
  const insets = useSafeAreaInsets();
  const selectedCard = useSharedValue(-1);
  const swipeY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(
    (e) => (scrollY.value = e.contentOffset.y),
  );
  const inTransition = useSharedValue(0);

  const scrollContainerStyle = useAnimatedStyle(() => {
    if (metrics.isIOS) return {};
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-metrics.screenHeight / 2, 0],
            [-metrics.screenHeight / 2, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <ScrollView>
      <StatusBar barStyle="light-content" />
      <SwipeGesture {...{ selectedCard, swipeY, inTransition }}>
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={{
            paddingTop: BACK_BUTTON_HEIGHT + insets.top + 16,
            paddingBottom:
              CARD_HEIGHT_CLOSED +
              CARD_MARGIN * (CARDS.length - 1) +
              insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={selectedCard.value === -1}
          decelerationRate="fast"
        >
          <Animated.View style={metrics.isIOS && scrollContainerStyle}>
            {CARDS.map((e, i) => (
              <Card
                key={i}
                item={e}
                index={i}
                {...{ selectedCard, scrollY, swipeY, inTransition }}
              />
            ))}
          </Animated.View>
        </Animated.ScrollView>
      </SwipeGesture>
      <BackButton
        color="rgba(0,0,0,0.8)"
        style={styles.backButton}
        iconSize={26}
      />
    </ScrollView>
  );
};

export default AppleWalletScreen;
