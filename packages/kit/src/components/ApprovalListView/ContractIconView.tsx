import { memo } from 'react';

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

  const contract = contractMap[address];

  if (isAllNetworks) {
    return (
      <Token
        size="lg"
        networkId={networkId}
        fallbackIcon={contract?.icon}
        showNetworkIcon
      />
    );
  }
  return <Token size="lg" fallbackIcon={contract?.icon} />;
}

export default memo(ContractIconView);
