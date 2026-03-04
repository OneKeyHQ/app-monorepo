import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
  },
});

function PerpMarketFooter() {
  const intl = useIntl();
  const actionsRef = useHyperliquidActions();
  const longButtonStyle = GetTradingButtonStyleProps('long');
  const shortButtonStyle = GetTradingButtonStyleProps('short');
  const navigation = useNavigation();

  const handleBuy = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'long' });
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [actionsRef, navigation]);

  const handleSell = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'short' });
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [actionsRef, navigation]);

  const buyGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(handleBuy)();
      }),
    [handleBuy],
  );

  const sellGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(handleSell)();
      }),
    [handleSell],
  );

  const buyButton = useMemo(
    () => (
      <GestureDetector gesture={buyGesture}>
        <View style={styles.buttonContainer}>
          <Button
            padding={0}
            height={38}
            borderRadius="$full"
            bg={longButtonStyle.bg}
            color={longButtonStyle.textColor}
            justifyContent="center"
            alignItems="center"
            testID="page-footer-cancel"
          >
            {intl.formatMessage({ id: ETranslations.perp_trade_long })}
          </Button>
        </View>
      </GestureDetector>
    ),
    [buyGesture, longButtonStyle, intl],
  );

  const sellButton = useMemo(
    () => (
      <GestureDetector gesture={sellGesture}>
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            padding={0}
            height={38}
            borderRadius="$full"
            bg={shortButtonStyle.bg}
            color={shortButtonStyle.textColor}
            justifyContent="center"
            alignItems="center"
            testID="page-footer-confirm"
          >
            {intl.formatMessage({ id: ETranslations.perp_trade_short })}
          </Button>
        </View>
      </GestureDetector>
    ),
    [sellGesture, shortButtonStyle, intl],
  );

  return <Page.Footer cancelButton={buyButton} confirmButton={sellButton} />;
}

export default PerpMarketFooter;
