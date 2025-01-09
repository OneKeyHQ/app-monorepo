import { memo, useCallback } from 'react';

import { flatMap } from 'lodash';

import {
  useDecodedTxsAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import {
  Address,
  Assets,
  Default,
  Network,
} from '../SignatureConfirmComponents';
import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  accountId: string;
  networkId: string;
};

function SignatureConfirmDetails(props: IProps) {
  const { accountId, networkId } = props;

  const [unsignedTxs] = useUnsignedTxsAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const isMultiTxs = decodedTxs?.length > 1;

  const renderSignatureConfirmDetails = useCallback(() => {
    let txDisplayComponents: {
      component: IDisplayComponent;
      txIndex: number;
    }[] = [];

    for (let i = 0; i < decodedTxs.length; i += 1) {
      const decodedTx = decodedTxs[i];
      const components = decodedTx.txDisplay?.components?.map((component) => ({
        component,
        txIndex: i,
      }));

      if (components) {
        txDisplayComponents = flatMap(txDisplayComponents.concat(components));
      }
    }

    return txDisplayComponents.map(({ component, txIndex }) => {
      switch (component.type) {
        case EParseTxComponentType.Default:
          return <Default component={component} />;
        case EParseTxComponentType.Approve:
          return (
            <Assets.TokenApproval
              component={component}
              accountId={accountId}
              networkId={networkId}
              editable={!isMultiTxs}
              approveInfo={unsignedTxs?.[txIndex]?.approveInfo}
            />
          );
        case EParseTxComponentType.Assets:
          return <Assets component={component} networkId={networkId} />;
        case EParseTxComponentType.Token:
          return <Assets.Token component={component} networkId={networkId} />;
        case EParseTxComponentType.NFT:
          return <Assets.NFT component={component} networkId={networkId} />;
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
  }, [accountId, decodedTxs, isMultiTxs, networkId, unsignedTxs]);

  return (
    <SignatureConfirmItem gap="$5">
      {renderSignatureConfirmDetails()}
    </SignatureConfirmItem>
  );
}

export default memo(SignatureConfirmDetails);
