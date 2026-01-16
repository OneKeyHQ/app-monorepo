import { memo } from 'react';

import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import {
  Address,
  Assets,
  DateTime,
  Default,
  Divider,
  Network,
  Simulation,
} from '../SignatureConfirmComponents';

interface IProps {
  accountId: string;
  networkId: string;
  displayComponents: {
    component: IDisplayComponent;
    approveInfo?: IApproveInfo;
  }[];
  isBridge?: boolean;
  isMultiSignatures?: boolean;
  isSendNativeTokenOnly?: boolean;
  nativeTokenTransferAmountToUpdate?: {
    isMaxSend: boolean;
    amountToUpdate: string;
  };
}

function SignatureConfirmDetails(props: IProps) {
  const {
    accountId,
    networkId,
    displayComponents,
    isBridge,
    isMultiSignatures,
    isSendNativeTokenOnly,
    nativeTokenTransferAmountToUpdate,
  } = props;

  return displayComponents.map(({ component, approveInfo }, index) => {
    switch (component.type) {
      case EParseTxComponentType.Divider:
        return <Divider key={`divider-${index}`} />;
      case EParseTxComponentType.Default:
        return <Default key={`default-${index}`} component={component} />;
      case EParseTxComponentType.DateTime:
        return <DateTime key={`datetime-${index}`} component={component} />;
      case EParseTxComponentType.Approve:
        return (
          <Assets.TokenApproval
            key={`approve-${index}`}
            component={component}
            accountId={accountId}
            networkId={networkId}
            editable={!isMultiSignatures}
            approveInfo={approveInfo}
            showNetwork={isBridge}
          />
        );
      case EParseTxComponentType.Assets:
        return (
          <Assets
            key={`assets-${index}`}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />
        );
      case EParseTxComponentType.InternalAssets:
        return (
          <Assets.InternalAssets
            key={`internal-assets-${index}`}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />
        );
      case EParseTxComponentType.Token:
        return (
          <Assets.Token
            key={`token-${index}`}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />
        );
      case EParseTxComponentType.NFT:
        return (
          <Assets.NFT
            key={`nft-${index}`}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
          />
        );
      case EParseTxComponentType.Network:
        return <Network key={`network-${index}`} component={component} />;
      case EParseTxComponentType.Address:
        return (
          <Address
            key={`address-${index}`}
            component={component}
            accountId={accountId}
            networkId={networkId}
            showAddressLocalTags
          />
        );
      case EParseTxComponentType.Simulation:
        return <Simulation key={`simulation-${index}`} component={component} />;
      default:
        return null;
    }
  });
}

export default memo(SignatureConfirmDetails);
