import { memo } from 'react';

import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';

import { useContractMapAtom } from '../../states/jotai/contexts/approvalList';
import { Token } from '../Token';

type IProps = {
  address: string;
  networkId: string;
  isAllNetworks?: boolean;
};

function ContractIconView(props: IProps) {
  const { address, networkId, isAllNetworks } = props;

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
