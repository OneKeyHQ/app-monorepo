import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button, Page, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

const MARKET_FOOTER_BUTTON_WIDTH = '47%';
const MARKET_FOOTER_BUTTON_HEIGHT = 36;
const MARKET_FOOTER_BUTTON_TEXT_LINE_HEIGHT = 20;

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

const styles = StyleSheet.create({
  buttonContainer: {
    width: MARKET_FOOTER_BUTTON_WIDTH,
  },
});

function PerpMarketFooter() {
  const intl = useIntl();
  const actionsRef = useHyperliquidActions();
  const { mode } = useActiveTradeDisplay();
  const longButtonStyle = GetTradingButtonStyleProps('long');
  const shortButtonStyle = GetTradingButtonStyleProps('short');
  const navigation = useAppNavigation();

  const buyText = intl.formatMessage({
    id:
      mode === 'spot'
        ? ETranslations.dexmarket_details_transactions_buy
        : ETranslations.perp_trade_long,
  });
  const sellText = intl.formatMessage({
    id:
      mode === 'spot'
        ? ETranslations.dexmarket_details_transactions_sell
        : ETranslations.perp_trade_short,
  });

  const handleBuy = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'long' });
    navigation.pop();
  }, [actionsRef, navigation]);

  const handleSell = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'short' });
    navigation.pop();
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
            width="100%"
            height={MARKET_FOOTER_BUTTON_HEIGHT}
            size="small"
            py="$0"
            borderRadius="$full"
            bg={longButtonStyle.bg}
            justifyContent="center"
            alignItems="center"
            childrenAsText={false}
            testID="page-footer-cancel"
          >
            <SizableText
              size="$bodyMdMedium"
              lineHeight={MARKET_FOOTER_BUTTON_TEXT_LINE_HEIGHT}
              color={longButtonStyle.textColor}
              numberOfLines={1}
              ellipsizeMode="tail"
              textAlign="center"
            >
              {buyText}
            </SizableText>
          </Button>
        </View>
      </GestureDetector>
    ),
    [buyGesture, longButtonStyle, buyText],
  );

  const sellButton = useMemo(
    () => (
      <GestureDetector gesture={sellGesture}>
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            width="100%"
            height={MARKET_FOOTER_BUTTON_HEIGHT}
            size="small"
            py="$0"
            borderRadius="$full"
            bg={shortButtonStyle.bg}
            justifyContent="center"
            alignItems="center"
            childrenAsText={false}
            testID="page-footer-confirm"
          >
            <SizableText
              size="$bodyMdMedium"
              lineHeight={MARKET_FOOTER_BUTTON_TEXT_LINE_HEIGHT}
              color={shortButtonStyle.textColor}
              numberOfLines={1}
              ellipsizeMode="tail"
              textAlign="center"
            >
              {sellText}
            </SizableText>
          </Button>
        </View>
      </GestureDetector>
    ),
    [sellGesture, shortButtonStyle, sellText],
  );

  return (
    <Page.Footer
      px="$2"
      pt="$3"
      pb="$10"
      cancelButton={buyButton}
      confirmButton={sellButton}
      buttonContainerProps={{
        width: '100%',
        justifyContent: 'center',
        gap: '$2',
      }}
    />
  );
}

export default PerpMarketFooter;
