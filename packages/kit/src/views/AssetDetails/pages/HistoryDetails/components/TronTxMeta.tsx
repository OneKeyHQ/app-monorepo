import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function TronAttributes({
  txDetails,
}: {
  decodedTx: IDecodedTx;
  txDetails?: IOnChainHistoryTx;
}) {
  const intl = useIntl();

  return (
    <>
      {txDetails && txDetails.receipt ? (
        <InfoItem
          label={intl.formatMessage({ id: ETranslations.global_resources })}
          renderContent={intl.formatMessage(
            {
              id: ETranslations.global_energy_bandwidth_num,
            },
            {
              num_1: txDetails.receipt.energyUsageTotal ?? '0',
              num_2: txDetails.receipt.netUsage ?? '0',
            },
          )}
        />
      ) : null}
    </>
  );
}

export { TronAttributes };
