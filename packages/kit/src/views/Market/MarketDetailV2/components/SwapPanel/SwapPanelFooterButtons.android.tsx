import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

type IProps = {
  onTrade: () => void;
  onInstant: () => void;
  disabled?: boolean;
};

function SwapPanelFooterButtons({ onTrade, onInstant, disabled }: IProps) {
  const intl = useIntl();

  // RNGH intercepts above the Button, so its `disabled` cannot stop these
  // gestures — the tap has to be dropped here as well.
  const tradeGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
          'worklet';

          runOnJS(onTrade)();
        }),
    [onTrade, disabled],
  );

  const instantGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
          'worklet';

          runOnJS(onInstant)();
        }),
    [onInstant, disabled],
  );

  return (
    <XStack gap="$2.5">
      <GestureDetector gesture={tradeGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailSwapButton}
            size="large"
            variant="secondary"
            disabled={disabled}
          >
            {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
          </Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={instantGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailBuyButton}
            size="large"
            variant="accent"
            icon="FlashSolid"
            disabled={disabled}
          >
            {intl.formatMessage({ id: ETranslations.dexmarket_quick_buy })}
          </Button>
        </View>
      </GestureDetector>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
