import { memo } from 'react';

import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';

import { useContractMapAtom } from '../../states/jotai/contexts/approvalList';
import { Token } from '../Token';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  address: string;
  networkId: string;
};

function ContractIconView(props: IProps) {
  const { address, networkId } = props;

  const { isAllNetworks } = useApprovalListViewContext();

  const [{ contractMap }] = useContractMapAtom();

  const contract = contractMap[
    approvalUtils.buildContractMapKey({
      networkId,
      contractAddress: address,
    })
  ] ?? {
    icon: 'Document2Outline',
  };

  if (isAllNetworks) {
    return (
      <Token
        isNFT
        size="lg"
        networkId={networkId}
        fallbackIcon={contract?.icon}
        showNetworkIcon
      />
    );
  }
  return <Token isNFT size="lg" fallbackIcon={contract?.icon} />;
}

export default memo(ContractIconView);
