import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import type { IAlertProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Tells users a OneToMany send is split and each tx needs its own signature
function BulkSendSplitTxAlert({
  txCount,
  ...rest
}: { txCount: number } & Omit<IAlertProps, 'title'>) {
  const intl = useIntl();
  return (
    <Alert
      icon="InfoCircleOutline"
      type="info"
      title={intl.formatMessage(
        { id: ETranslations.wallet_bulk_send_split_txns_description },
        { count: txCount },
      )}
      {...rest}
    />
  );
}

export default BulkSendSplitTxAlert;
