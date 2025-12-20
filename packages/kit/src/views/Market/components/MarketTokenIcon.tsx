import { memo } from 'react';

import { Token } from '../../../components/Token';

import type { ITokenProps } from '../../../components/Token';

function BasicMarketTokenIcon({
  uri,
  size,
  networkId,
}: {
  uri: string;
  size: ITokenProps['size'];
  networkId?: string;
}) {
  return (
    <Token
      size={size}
      tokenImageUri={uri}
      networkId={networkId}
      showNetworkIcon={Boolean(networkId)}
    />
  );
}

export const MarketTokenIcon = memo(BasicMarketTokenIcon);
