import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

const MARKET_FOOTER_BUTTON_WIDTH = '44%';
const MARKET_FOOTER_BUTTON_HEIGHT = 36;

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
      pt="$3"
      pb="$8"
      onCancelText={buyText}
      onConfirmText={sellText}
      cancelButtonProps={{
        width: MARKET_FOOTER_BUTTON_WIDTH,
        height: MARKET_FOOTER_BUTTON_HEIGHT,
        size: 'small',
        borderRadius: '$full',
        bg: longButtonStyle.bg,
        hoverStyle: longButtonStyle.hoverStyle,
        pressStyle: longButtonStyle.pressStyle,
        color: longButtonStyle.textColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      confirmButtonProps={{
        width: MARKET_FOOTER_BUTTON_WIDTH,
        height: MARKET_FOOTER_BUTTON_HEIGHT,
        size: 'small',
        borderRadius: '$full',
        bg: shortButtonStyle.bg,
        hoverStyle: shortButtonStyle.hoverStyle,
        pressStyle: shortButtonStyle.pressStyle,
        color: shortButtonStyle.textColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      buttonContainerProps={{
        width: '100%',
        justifyContent: 'space-between',
      }}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}

export default PerpMarketFooter;
