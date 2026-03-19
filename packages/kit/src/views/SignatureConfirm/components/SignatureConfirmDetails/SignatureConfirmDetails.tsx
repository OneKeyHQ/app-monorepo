import { memo, useMemo } from 'react';

import {
  ERiskCheckCategory,
  RiskDetectionCard,
} from '@onekeyhq/kit/src/components/RiskDetectionCard';
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

import type { IRiskCheckItem } from '@onekeyhq/kit/src/components/RiskDetectionCard';

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
  riskChecks?: IRiskCheckItem[];
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
    riskChecks,
  } = props;

  // Hide risk tags on addresses when the Address Risk check has signals
  const hideRiskTags = useMemo(
    () =>
      riskChecks?.some(
        (c) => c.category === ERiskCheckCategory.AddressRisk && !c.passed,
      ) ?? false,
    [riskChecks],
  );

  // Find the index of the last Address component to insert card after it
  const lastAddressIndex = useMemo(() => {
    let last = -1;
    for (let i = displayComponents.length - 1; i >= 0; i -= 1) {
      if (
        displayComponents[i].component.type === EParseTxComponentType.Address
      ) {
        last = i;
        break;
      }
    }
    return last;
  }, [displayComponents]);

  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < displayComponents.length; index += 1) {
    const { component, approveInfo } = displayComponents[index];

    switch (component.type) {
      case EParseTxComponentType.Divider:
        nodes.push(<Divider key={index} />);
        break;
      case EParseTxComponentType.Default:
        nodes.push(<Default key={index} component={component} />);
        break;
      case EParseTxComponentType.DateTime:
        nodes.push(<DateTime key={index} component={component} />);
        break;
      case EParseTxComponentType.Approve:
        nodes.push(
          <Assets.TokenApproval
            key={index}
            component={component}
            accountId={accountId}
            networkId={networkId}
            editable={!isMultiSignatures}
            approveInfo={approveInfo}
            showNetwork={isBridge}
          />,
        );
        break;
      case EParseTxComponentType.Assets:
        nodes.push(
          <Assets
            key={index}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />,
        );
        break;
      case EParseTxComponentType.InternalAssets:
        nodes.push(
          <Assets.InternalAssets
            key={index}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />,
        );
        break;
      case EParseTxComponentType.Token:
        nodes.push(
          <Assets.Token
            key={index}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
            isSendNativeTokenOnly={isSendNativeTokenOnly}
            nativeTokenTransferAmountToUpdate={
              nativeTokenTransferAmountToUpdate
            }
          />,
        );
        break;
      case EParseTxComponentType.NFT:
        nodes.push(
          // oxlint-disable-next-line react/jsx-pascal-case -- NFT is an acronym
          <Assets.NFT
            key={index}
            component={component}
            networkId={networkId}
            showNetwork={isBridge}
          />,
        );
        break;
      case EParseTxComponentType.Network:
        nodes.push(<Network key={index} component={component} />);
        break;
      case EParseTxComponentType.Address:
        nodes.push(
          <Address
            key={index}
            component={component}
            accountId={accountId}
            networkId={networkId}
            showAddressLocalTags
            hideRiskTags={hideRiskTags}
          />,
        );
        break;
      case EParseTxComponentType.Simulation:
        nodes.push(<Simulation key={index} component={component} />);
        break;
      default:
        break;
    }

    // Insert RiskDetectionCard after the last Address component
    if (index === lastAddressIndex && riskChecks) {
      nodes.push(
        <RiskDetectionCard key="risk-detection-card" checks={riskChecks} />,
      );
    }
  }

  // Fallback: if no Address component, append card at the end
  if (lastAddressIndex === -1 && riskChecks) {
    nodes.push(
      <RiskDetectionCard key="risk-detection-card" checks={riskChecks} />,
    );
  }

  return nodes;
}

export default memo(SignatureConfirmDetails);
