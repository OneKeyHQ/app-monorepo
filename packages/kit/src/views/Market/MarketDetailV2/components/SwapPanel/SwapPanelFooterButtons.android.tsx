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
  onBuy: () => void;
  onSell: () => void;
};

function SwapPanelFooterButtons({ onBuy, onSell }: IProps) {
  const intl = useIntl();

  const buyGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(onBuy)();
      }),
    [onBuy],
  );

  const sellGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(onSell)();
      }),
    [onSell],
  );

  return (
    <XStack gap="$2" alignItems="center">
      <GestureDetector gesture={buyGesture}>
        <View>
          <Button
            size="small"
            variant="primary"
            w="$28"
            h="$12"
            bg="$buttonSuccess"
          >
            {intl.formatMessage({
              id: ETranslations.global_buy,
            })}
          </Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={sellGesture}>
        <View>
          <Button
            w="$28"
            h="$12"
            size="small"
            bg="$buttonCritical"
            variant="primary"
          >
            {intl.formatMessage({
              id: ETranslations.global_sell,
            })}
          </Button>
        </View>
      </GestureDetector>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
