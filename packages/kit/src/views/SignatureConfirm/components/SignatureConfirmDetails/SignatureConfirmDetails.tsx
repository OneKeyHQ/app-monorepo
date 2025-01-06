import { memo, useCallback } from 'react';

import { flatMap, map } from 'lodash';

import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { Address, Network } from '../SignatureConfirmComponents';
import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  accountId: string;
  networkId: string;
  decodedTxs: IDecodedTx[];
};

function SignatureConfirmDetails(props: IProps) {
  const { accountId, networkId, decodedTxs } = props;

  const renderSignatureConfirmDetails = useCallback(() => {
    const txDisplayComponents = flatMap(
      map(decodedTxs, (tx) => tx.txDisplay?.components),
    ).filter(Boolean);
    return txDisplayComponents.map((component) => {
      switch (component.type) {
        case EParseTxComponentType.Network:
          return <Network component={component} />;
        case EParseTxComponentType.Address:
          return (
            <Address
              component={component}
              accountId={accountId}
              networkId={networkId}
              showAddressLocalTags
            />
          );
        default:
          return null;
      }
    });
  }, [accountId, decodedTxs, networkId]);

  return (
    <SignatureConfirmItem gap="$5">
      {renderSignatureConfirmDetails()}
    </SignatureConfirmItem>
  );
}

export default memo(SignatureConfirmDetails);
