import { useIntl } from 'react-intl';

import type { IDecodedTxExtraDnx } from '@onekeyhq/core/src/chains/dnx/types';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function DnxFlow({ decodedTx }: { decodedTx: IDecodedTx }) {
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

function DnxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const dnxExtraInfo = decodedTx.extraInfo as IDecodedTxExtraDnx;

  return (
    <>
      {dnxExtraInfo?.paymentId ? (
        <InfoItem label="Payment ID" renderContent={dnxExtraInfo.paymentId} />
      ) : null}
    </>
  );
}

export { DnxFlow, DnxAttributes };
