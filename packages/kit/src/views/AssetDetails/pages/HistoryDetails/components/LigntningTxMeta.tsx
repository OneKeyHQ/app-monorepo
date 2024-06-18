import { useIntl } from 'react-intl';

import type { IDecodedTxExtraLightning } from '@onekeyhq/core/src/chains/lightning/types';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function LightningTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const lightningExtraInfo = decodedTx.extraInfo as IDecodedTxExtraLightning;

  if (!lightningExtraInfo) return null;

  return (
    <>
      {lightningExtraInfo?.description ? (
        <InfoItem
          label="Description"
          renderContent={lightningExtraInfo.description}
        />
      ) : null}
      {lightningExtraInfo?.preImage ? (
        <InfoItem
          label="Preimage"
          renderContent={lightningExtraInfo.preImage}
        />
      ) : null}
    </>
  );
}

function LightningTxFlow({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const transferAction = decodedTx.actions[0];
  const { networkId, accountId } = decodedTx;
  const { account } = useAccountData({ accountId, networkId });

  if (
    transferAction &&
    transferAction.type === EDecodedTxActionType.ASSET_TRANSFER
  ) {
    if (transferAction.direction === EDecodedTxDirection.IN) {
      return (
        <InfoItem
          label={intl.formatMessage({ id: ETranslations.global_to })}
          renderContent={
            <AddressInfo
              address={account?.addressDetail.normalizedAddress ?? ''}
              accountId={accountId}
              networkId={networkId}
            />
          }
        />
      );
    }
    return (
      <InfoItem
        label={intl.formatMessage({ id: ETranslations.global_from })}
        renderContent={
          <AddressInfo
            address={account?.addressDetail.normalizedAddress ?? ''}
            accountId={accountId}
            networkId={networkId}
          />
        }
      />
    );
  }
  return null;
}

export { LightningTxAttributes, LightningTxFlow };
