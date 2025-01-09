import { useIntl } from 'react-intl';

import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function AdaTxFlow({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const { networkId, accountId } = decodedTx;

  if (decodedTx.signer && decodedTx.to) {
    return (
      <>
        <InfoItem
          label={intl.formatMessage({ id: ETranslations.global_from })}
          renderContent={decodedTx.signer}
          showCopy
          description={
            <AddressInfo
              address={decodedTx.signer}
              accountId={accountId}
              networkId={networkId}
            />
          }
        />
        <InfoItem
          label={intl.formatMessage({ id: ETranslations.global_to })}
          showCopy
          renderContent={decodedTx.to}
          description={
            <AddressInfo
              address={decodedTx.to}
              accountId={accountId}
              networkId={networkId}
            />
          }
        />
      </>
    );
  }

  return null;
}

export { AdaTxFlow };
