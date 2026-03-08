import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { GetTradingButtonStyleProps } from '../utils/styleUtils';

function PerpMarketFooter() {
  const intl = useIntl();
  const actionsRef = useHyperliquidActions();
  const longButtonStyle = GetTradingButtonStyleProps('long');
  const shortButtonStyle = GetTradingButtonStyleProps('short');

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
      onCancelText={intl.formatMessage({
        id: ETranslations.perp_trade_long,
      })}
      onConfirmText={intl.formatMessage({
        id: ETranslations.perp_trade_short,
      })}
      cancelButtonProps={{
        flex: 1,
        padding: 0,
        height: 38,
        borderRadius: '$full',
        bg: longButtonStyle.bg,
        hoverStyle: longButtonStyle.hoverStyle,
        pressStyle: longButtonStyle.pressStyle,
        color: longButtonStyle.textColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      confirmButtonProps={{
        flex: 1,
        padding: 0,
        height: 38,
        borderRadius: '$full',
        bg: shortButtonStyle.bg,
        hoverStyle: shortButtonStyle.hoverStyle,
        pressStyle: shortButtonStyle.pressStyle,
        color: shortButtonStyle.textColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}

export default PerpMarketFooter;
