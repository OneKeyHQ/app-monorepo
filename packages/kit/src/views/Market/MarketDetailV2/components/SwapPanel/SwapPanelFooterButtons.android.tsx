import { useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

import type { IMarketDetailFooterMode } from '../../utils/marketMobileDetailKind';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

type IProps = {
  mode: IMarketDetailFooterMode;
  onTrade: () => void;
  onPerps?: () => void;
  tradeDisabled?: boolean;
  perpsDisabled?: boolean;
};

function SwapPanelFooterButtons({
  mode,
  onTrade,
  onPerps,
  tradeDisabled,
  perpsDisabled,
}: IProps) {
  const intl = useIntl();
  const tradeLabel = intl.formatMessage({
    id: ETranslations.dexmarket_details_trade,
  });

  // RNGH intercepts above the Button, so its `disabled` cannot stop these
  // gestures — the tap has to be dropped here as well.
  const tradeGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!tradeDisabled)
        .onEnd(() => {
          'worklet';

          runOnJS(onTrade)();
        }),
    [onTrade, tradeDisabled],
  );

  const handlePerps = onPerps ?? noop;
  const perpsGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!perpsDisabled && Boolean(onPerps))
        .onEnd(() => {
          'worklet';

          runOnJS(handlePerps)();
        }),
    [handlePerps, onPerps, perpsDisabled],
  );

  if (mode === 'trade') {
    return (
      <GestureDetector gesture={tradeGesture}>
        <View>
          <Button
            testID={MarketTestIDs.detailSwapButton}
            size="large"
            variant="primary"
            width="100%"
            disabled={tradeDisabled}
          >
            {tradeLabel}
          </Button>
        </View>
      </GestureDetector>
    );
  }

  return (
    <XStack gap="$2.5">
      <GestureDetector gesture={perpsGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailPerpsButton}
            size="large"
            variant="secondary"
            disabled={perpsDisabled}
          >
            {intl.formatMessage({ id: ETranslations.perps_perps })}
          </Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={tradeGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailSwapButton}
            size="large"
            variant="primary"
            disabled={tradeDisabled}
          >
            {tradeLabel}
          </Button>
        </View>
      </GestureDetector>
    </XStack>
  );
}

export default SwapPanelFooterButtons;
