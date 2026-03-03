import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

type IProps = {
  onTrade: () => void;
  onInstant: () => void;
};

function SwapPanelFooterButtons({ onTrade, onInstant }: IProps) {
  const intl = useIntl();

  const tradeGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(onTrade)();
      }),
    [onTrade],
  );

  const instantGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(onInstant)();
      }),
    [onInstant],
  );

  return (
    <XStack gap="$2.5">
      <GestureDetector gesture={tradeGesture}>
        <View style={{ flex: 1 }}>
          <Button size="large" variant="secondary">
            {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
          </Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={instantGesture}>
        <View style={{ flex: 1 }}>
          <Button
            size="large"
            variant="primary"
            bg="$buttonSuccess"
            icon="FlashSolid"
          >
            {intl.formatMessage({ id: ETranslations.dexmarket_quick_buy })}
          </Button>
        </View>
      </GestureDetector>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
