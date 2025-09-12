import { memo } from 'react';

import { useAccountData } from '../../hooks/useAccountData';
import { Token } from '../Token';

type IProps = {
  icon?: string;
  networkId: string | undefined;
  isAllNetworks?: boolean;
  showNetworkIcon?: boolean;
};

function TokenIconView(props: IProps) {
  const { icon, networkId, isAllNetworks, showNetworkIcon } = props;

  const { network } = useAccountData({ networkId });

  if (isAllNetworks && showNetworkIcon) {
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
