import { memo } from 'react';

import type { IAddressInfo } from '@onekeyhq/shared/types/address';

import { Token } from '../Token';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  address: string;
  networkId: string;
  contract?: IAddressInfo;
};

function ContractIconView(props: IProps) {
  const { networkId, contract } = props;

  const { isAllNetworks } = useApprovalListViewContext();

  if (isAllNetworks) {
    return (
      <Token
        isNFT
        size="lg"
        networkId={networkId}
        tokenImageUri={contract?.logoURI}
        fallbackIcon={contract?.icon ?? 'Document2Outline'}
        showNetworkIcon
      />
    );
  }
  return (
    <Token
      isNFT
      size="lg"
      tokenImageUri={contract?.logoURI}
      fallbackIcon={contract?.icon ?? 'Document2Outline'}
    />
  );
}

export default memo(ContractIconView);
