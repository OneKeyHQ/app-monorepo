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
          ? ETranslations.token_selector_risk_reminder_malicious_token_alert
          : ETranslations.swap_page_price_impact_title,
      })}
      description={
        isHoneypot
          ? undefined
          : intl.formatMessage({
              id: ETranslations.swap_page_price_impact_content_2,
            })
      }
    />
  );
}

export default memo(SwapQuoteRiskAlert);
