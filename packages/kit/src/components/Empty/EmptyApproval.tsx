import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptyApproval() {
  const intl = useIntl();
  return (
    <Empty
      testID="Wallet-No-Token-Empty"
      icon="ClockTimeHistoryOutline"
      title={intl.formatMessage({
        id: ETranslations.wallet_title_no_approvals,
      })}
      description={intl.formatMessage({
        id: ETranslations.wallet_description_no_approvals,
      })}
    />
  );
}

export { EmptyApproval };
