import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getSwapQuoteTokenRisk } from '../../utils/swapQuoteRiskUtils';

function SwapQuoteRiskAlert(
  props: Parameters<typeof getSwapQuoteTokenRisk>[0],
) {
  const intl = useIntl();
  const risk = getSwapQuoteTokenRisk(props);
  if (!risk) {
    return null;
  }
  const isHoneypot = risk === 'honeypot';
  return (
    <Alert
      testID="swap-token-risk-alert"
      type={isHoneypot ? 'critical' : 'warning'}
      icon={isHoneypot ? 'ErrorOutline' : 'InfoCircleOutline'}
      title={intl.formatMessage({
        id: isHoneypot
          ? ETranslations.trade_warning_honeypot_detected
          : ETranslations.trade_warning_low_token_liquidity,
      })}
    />
  );
}

export default memo(SwapQuoteRiskAlert);
