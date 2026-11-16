import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { useEtherFiLegacyApproval } from '../hooks/useEtherFiLegacyApproval';

export function EtherFiLegacyApprovalAlert({
  approval,
}: {
  approval: ReturnType<typeof useEtherFiLegacyApproval>;
}) {
  const intl = useIntl();
  if (approval.status === 'required') {
    const text = intl.formatMessage(
      { id: ETranslations.global_revoke_approve },
      { symbol: 'liquidUSD' },
    );
    return (
      <Alert
        type="warning"
        title={text}
        action={{ primary: text, onPrimaryPress: () => void approval.revoke() }}
      />
    );
  }
  if (approval.status === 'pending' || approval.status === 'unknown') {
    return (
      <Alert
        type="warning"
        title={intl.formatMessage({
          id:
            approval.status === 'pending'
              ? ETranslations.global_pending
              : ETranslations.global_an_error_occurred,
        })}
        action={{
          primary: intl.formatMessage({ id: ETranslations.global_retry }),
          onPrimaryPress: () => void approval.refresh(),
        }}
      />
    );
  }
  return null;
}
