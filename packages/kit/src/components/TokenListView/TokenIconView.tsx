import { memo } from 'react';

import { useAccountData } from '../../hooks/useAccountData';
import { Token } from '../Token';

type IProps = {
  icon?: string;
  networkId: string | undefined;
  isAllNetworks?: boolean;
};

function TokenIconView(props: IProps) {
  const { icon, networkId, isAllNetworks } = props;

  const { network } = useAccountData({ networkId });

  if (isAllNetworks) {
    return (
      <Token
        size="lg"
        tokenImageUri={icon}
        networkImageUri={network?.logoURI}
        networkId={networkId}
        showNetworkIcon
      />
    );
  }

  return <Token size="lg" tokenImageUri={icon} />;
}

export default memo(TokenIconView);
