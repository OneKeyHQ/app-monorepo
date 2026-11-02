import { useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, Icon, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../../../testIDs';

import type { IMarketDetailFooterMode } from '../../utils/marketMobileDetailKind';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

function useFooterTap(onPress: () => void, disabled?: boolean) {
  // The gesture intercepts above Button, so it must enforce disabled itself.
  return useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
          'worklet';
          runOnJS(onPress)();
        }),
    [disabled, onPress],
  );
}

type IProps = {
  mode: IMarketDetailFooterMode;
  onBuy: () => void;
  onSell: () => void;
  onPerps?: () => void;
  tradeDisabled?: boolean;
  perpsDisabled?: boolean;
};

function SwapPanelFooterButtons({
  mode,
  onBuy,
  onSell,
  onPerps,
  tradeDisabled,
  perpsDisabled,
}: IProps) {
  const intl = useIntl();
  const buyGesture = useFooterTap(onBuy, tradeDisabled);
  const sellGesture = useFooterTap(onSell, tradeDisabled);
  const perpsGesture = useFooterTap(onPerps ?? noop, perpsDisabled || !onPerps);

  return (
    <XStack gap="$2.5">
      <GestureDetector gesture={buyGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailBuyButton}
            size="large"
            height={50}
            variant="secondary"
            bg="$bgSuccessStrong"
            color="$textOnColor"
            hoverStyle={{ bg: '$success10' }}
            pressStyle={{ bg: '$success11' }}
            disabled={tradeDisabled}
          >
            {intl.formatMessage({ id: ETranslations.global_buy })}
          </Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={sellGesture}>
        <View style={{ flex: 1 }}>
          <Button
            testID={MarketTestIDs.detailSellButton}
            size="large"
            height={50}
            variant="destructive"
            disabled={tradeDisabled}
          >
            {intl.formatMessage({ id: ETranslations.global_sell })}
          </Button>
        </View>
      </GestureDetector>
      {mode === 'perps-buy-sell' ? (
        <GestureDetector gesture={perpsGesture}>
          <View style={{ width: 50 }}>
            <Button
              testID={MarketTestIDs.detailPerpsButton}
              size="large"
              height={50}
              variant="secondary"
              width={50}
              px="$3"
              childrenAsText={false}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.perps_perps,
              })}
              disabled={perpsDisabled}
            >
              <Icon name="TradeOutline" size="$6" color="$icon" />
            </Button>
          </View>
        </GestureDetector>
      ) : null}
    </XStack>
  );
}

export default SwapPanelFooterButtons;
