import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

const MARKET_FOOTER_BUTTON_HEIGHT = 36;
const MARKET_FOOTER_BUTTON_TEXT_LINE_HEIGHT = 20;

function PerpMarketFooter() {
  const intl = useIntl();
  const actionsRef = useHyperliquidActions();
  const { mode } = useActiveTradeDisplay();
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

  const handleCancel = useCallback(
    (close: () => void) => {
      actionsRef.current.updateTradingForm({ side: 'long' });
      close();
    },
    [actionsRef],
  );

  const handleConfirm = useCallback(
    (close: () => void) => {
      actionsRef.current.updateTradingForm({ side: 'short' });
      close();
    },
    [actionsRef],
  );

  return (
    <Page.Footer
      px="$2"
      pt="$3"
      pb="$10"
      cancelButton={
        <Page.CancelButton
          flex={1}
          height={MARKET_FOOTER_BUTTON_HEIGHT}
          size="small"
          py="$0"
          borderRadius="$full"
          bg={longButtonStyle.bg}
          hoverStyle={longButtonStyle.hoverStyle}
          pressStyle={longButtonStyle.pressStyle}
          justifyContent="center"
          alignItems="center"
          childrenAsText={false}
          onCancel={handleCancel}
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
        </Page.CancelButton>
      }
      confirmButton={
        <Page.ConfirmButton
          flex={1}
          height={MARKET_FOOTER_BUTTON_HEIGHT}
          size="small"
          py="$0"
          borderRadius="$full"
          bg={shortButtonStyle.bg}
          hoverStyle={shortButtonStyle.hoverStyle}
          pressStyle={shortButtonStyle.pressStyle}
          justifyContent="center"
          alignItems="center"
          childrenAsText={false}
          onConfirm={handleConfirm}
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
        </Page.ConfirmButton>
      }
      buttonContainerProps={{
        width: '100%',
        justifyContent: 'center',
        gap: '$2',
      }}
    />
  );
}

export default PerpMarketFooter;
