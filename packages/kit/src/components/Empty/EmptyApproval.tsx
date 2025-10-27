import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function EmptyApproval() {
  const intl = useIntl();
  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-No-Approval-Empty"
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
