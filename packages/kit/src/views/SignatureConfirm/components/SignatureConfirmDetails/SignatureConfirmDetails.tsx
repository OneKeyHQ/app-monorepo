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

  return displayComponents.map(({ component, approveInfo }) => {
    switch (component.type) {
      case EParseTxComponentType.Divider:
        return <Divider />;
      case EParseTxComponentType.Default:
        return <Default component={component} />;
      case EParseTxComponentType.DateTime:
        return <DateTime component={component} />;
      case EParseTxComponentType.Approve:
        return (
          <Assets.TokenApproval
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
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
          />
        );
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
}

export default memo(SignatureConfirmDetails);
