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
        return <Divider key={index} />;
      case EParseTxComponentType.Default:
        return <Default key={index} component={component} />;
      case EParseTxComponentType.DateTime:
        return <DateTime key={index} component={component} />;
      case EParseTxComponentType.Approve:
        return (
          <Assets.TokenApproval
            key={index}
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
            key={index}
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
            key={index}
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
            key={index}
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
          // oxlint-disable-next-line react/jsx-pascal-case -- NFT is an acronym
          <Assets.NFT
            key={index}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
          />
        );
      case EParseTxComponentType.Network:
        return <Network key={index} component={component} />;
      case EParseTxComponentType.Address:
        return (
          <Address
            key={index}
            component={component}
            accountId={accountId}
            networkId={networkId}
            showAddressLocalTags
          />
        );
      case EParseTxComponentType.Simulation:
        return <Simulation key={index} component={component} />;
      default:
        return null;
    }
  });
}

export default memo(SignatureConfirmDetails);
