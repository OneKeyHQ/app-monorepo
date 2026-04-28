import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Page,
  SizableText,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

const MARKET_FOOTER_BUTTON_WIDTH = '47%';
const MARKET_FOOTER_BUTTON_HEIGHT = 36;

const styles = StyleSheet.create({
  buttonContainer: {
    width: MARKET_FOOTER_BUTTON_WIDTH,
  },
});

function PerpMarketFooter() {
  const intl = useIntl();
  const actionsRef = useHyperliquidActions();
  const { mode } = useActiveTradeDisplay();
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const longButtonStyle = GetTradingButtonStyleProps('long');
  const shortButtonStyle = GetTradingButtonStyleProps('short');

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

  const handleCancel = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'long' });
    navigation.pop();
  }, [actionsRef, navigation]);

  const handleConfirm = useCallback(() => {
    actionsRef.current.updateTradingForm({ side: 'short' });
    navigation.pop();
  }, [actionsRef, navigation]);

  const buyButton = useMemo(
    () => (
      <View style={styles.buttonContainer}>
        <Button
          width="100%"
          height={MARKET_FOOTER_BUTTON_HEIGHT}
          size="small"
          borderRadius="$full"
          bg={longButtonStyle.bg}
          hoverStyle={longButtonStyle.hoverStyle}
          pressStyle={longButtonStyle.pressStyle}
          color={longButtonStyle.textColor}
          justifyContent="center"
          alignItems="center"
          childrenAsText={false}
          onPress={handleCancel}
          testID="page-footer-cancel"
        >
          <SizableText
            size="$bodyMdMedium"
            lineHeight={18}
            color={longButtonStyle.textColor}
          >
            {buyText}
          </SizableText>
        </Button>
      </View>
    ),
    [buyText, handleCancel, longButtonStyle],
  );

  const sellButton = useMemo(
    () => (
      <View style={styles.buttonContainer}>
        <Button
          variant="primary"
          width="100%"
          height={MARKET_FOOTER_BUTTON_HEIGHT}
          size="small"
          borderRadius="$full"
          bg={shortButtonStyle.bg}
          hoverStyle={shortButtonStyle.hoverStyle}
          pressStyle={shortButtonStyle.pressStyle}
          color={shortButtonStyle.textColor}
          justifyContent="center"
          alignItems="center"
          childrenAsText={false}
          onPress={handleConfirm}
          testID="page-footer-confirm"
        >
          <SizableText
            size="$bodyMdMedium"
            lineHeight={18}
            color={shortButtonStyle.textColor}
          >
            {sellText}
          </SizableText>
        </Button>
      </View>
    ),
    [handleConfirm, sellText, shortButtonStyle],
  );

  return (
    <Page.Footer
      px="$2"
      pt="$3"
      pb={Math.max(bottom + 8, 32)}
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
